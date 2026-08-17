import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import {
  TRACKER_STAGES,
  TRACKER_STAGE_CONFIG,
  SUB_STATUSES,
  stageIndex,
  todayISO,
  type TrackerStage,
  type SubStatus,
} from '../domain/constants';
import { BusinessRuleError, NotFoundError, ValidationError } from '../domain/errors';
import { assertMeaningfulText } from '../domain/textValidation';
import { hasExternalFormData } from '../domain/externalFormGate';
import { supplierInclude, toSupplierDTO } from '../mappers/supplierMapper';
import { syncSupplierSla, syncSuppliersSla } from './slaService';
import { notifyTeam } from './notificationsService';
import type { AuthUser } from '../middleware/auth';

export function getStageConfig() {
  return TRACKER_STAGE_CONFIG;
}

/** Suppliers in the tracker (ACTIVE + COMPLETED), filtered by stage. */
export async function listByStage(prisma: PrismaClient, stage?: string) {
  if (stage !== undefined && !TRACKER_STAGES.includes(stage as TrackerStage)) {
    throw new ValidationError(`Unknown stage: ${stage}`);
  }
  const rows = await prisma.supplier.findMany({
    where: {
      status: { is: { name: { in: ['ACTIVE', 'COMPLETED'] } } },
      // Direct Material only (business rule); Indirect filtered out.
      productCategory: { is: { name: 'Direct' } },
      ...(stage ? { stage: { is: { name: stage } } } : {}),
    },
    include: supplierInclude,
    orderBy: { folio: 'asc' },
  });
  return (await syncSuppliersSla(prisma, rows)).map(toSupplierDTO);
}

export async function getTrackerSupplier(prisma: PrismaClient, id: string) {
  const row = await prisma.supplier.findUnique({ where: { id }, include: supplierInclude });
  if (!row) throw new NotFoundError(`Supplier ${id} not found`);
  return toSupplierDTO(await syncSupplierSla(prisma, row));
}

/** Validates a stage transition: forward-only; 'Completed' only from Intelex Handoff. */
export async function moveSupplierToStage(
  prisma: PrismaClient,
  supplierId: string,
  newStage: string,
  note: string,
  actor: AuthUser,
) {
  // A real, specific note is mandatory when advancing a stage — validated up
  // front (before any DB access) with the same rule notes/rejection reasons use.
  const trimmedNote = assertMeaningfulText(note, 'Stage-change note');
  if (!TRACKER_STAGES.includes(newStage as TrackerStage)) {
    throw new ValidationError(`Unknown stage: ${newStage}`);
  }
  // 'Blacklisted' isn't a /move target — use the blacklist endpoint.
  if (newStage === 'Blacklisted') {
    throw new BusinessRuleError('Use the blacklist endpoint to blacklist a supplier');
  }
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    include: { status: true, stage: true, companyInfo: true, parkingData: true },
  });
  if (!supplier) throw new NotFoundError(`Supplier ${supplierId} not found`);
  const currentStage = supplier.stage.name;

  if (supplier.status.name === 'BLACKLISTED') {
    throw new BusinessRuleError('Blacklisted suppliers cannot be moved');
  }
  if (supplier.status.name === 'COMPLETED' || currentStage === 'Completed') {
    throw new BusinessRuleError(
      'Completed is a terminal state — suppliers cannot leave it via the standard API',
    );
  }
  if (currentStage === newStage) {
    throw new BusinessRuleError(`Supplier is already in stage "${newStage}"`);
  }
  if (stageIndex(newStage) < stageIndex(currentStage)) {
    throw new BusinessRuleError('No se permite mover un proveedor hacia una etapa anterior');
  }
  if (newStage === 'Completed' && currentStage !== 'Intelex Handoff') {
    throw new BusinessRuleError('Only suppliers in Intelex Handoff can be completed');
  }
  // Real business gate (not just a PreliminaryPrefillModal form requirement):
  // a supplier can't reach Preliminary Evaluation without the data the external
  // form is supposed to have captured (DUNS number, manufacturing country /
  // address — see domain/externalFormGate.ts, same rule the future
  // T_Event_Prospect creation hook in eventsService.ts will reuse). This runs
  // after `note` (assertMeaningfulText, validated up front with no DB access)
  // because it needs the supplier row just fetched above; it's grouped with the
  // other supplier-state guards rather than moved ahead of the note check, so a
  // bad note is still reported without spending a query first.
  if (newStage === 'Preliminary Evaluation') {
    const formCheck = hasExternalFormData(supplier);
    if (!formCheck.complete) {
      throw new BusinessRuleError(
        `Cannot move to Preliminary Evaluation — missing data from the supplier's external form: `
        + `${formCheck.missing.join(', ')}. Complete these fields (Company Information / `
        + `Parking Lot manufacturing details) before advancing.`,
      );
    }
  }

  // Resolve the destination stage id for the structured history columns.
  const targetStage = await prisma.stage.findUniqueOrThrow({ where: { name: newStage } });

  const today = todayISO();
  await prisma.$transaction(async tx => {
    await tx.supplier.update({
      where: { id: supplierId },
      data: {
        stage: { connect: { name: newStage } },
        daysInStage: 0,
        // Stamp when the supplier entered this (its new current) stage.
        stageEnteredAt: new Date(),
        // Record origin stage when exiting to a terminal state.
        ...(newStage === 'Completed'
          ? { status: { connect: { name: 'COMPLETED' } }, stageBeforeExit: currentStage }
          : {}),
      },
    });
    if (newStage === 'Completed') {
      await tx.completionEntry.create({
        data: { supplierId, completedDate: today, completedBy: actor.displayName },
      });
      // Closing the handoff drives the Intelex sub-status to its terminal value.
      // (Completed is only reachable from Intelex Handoff, so the satellite already
      // exists; upsert keeps it safe either way.)
      await tx.intelexData.upsert({
        where: { supplierId },
        create: { supplierId, currentLevel: 'Completed' },
        update: { currentLevel: 'Completed' },
      });
    } else {
      await ensureStageSatellite(tx, supplierId, newStage as TrackerStage);
    }
    await tx.supplierHistoryEntry.create({
      data: {
        supplierId,
        date: today,
        action: `Moved from ${currentStage} to ${newStage}`,
        user: actor.displayName,
        role: actor.role,
        note: trimmedNote,
        fromStageId: supplier.stageId,
        toStageId: targetStage.id,
      },
    });
    // Persist the note as a real SupplierNote too (tagged to the DESTINATION
    // stage — "why it moved TO here"), so it shows in the notes panel without
    // any frontend change. Mirrors notesService.addSupplierNote exactly.
    await tx.supplierNote.create({
      data: {
        id: `note-${randomUUID()}`,
        supplier: { connect: { id: supplierId } },
        text: trimmedNote,
        author: actor.displayName,
        role: actor.role,
        date: today,
        stage: { connect: { name: newStage } },
      },
    });
    // Notify inside the transaction; swallow failures so notifying can't roll back the move.
    try {
      await notifyTeam(tx, {
        message: `${supplier.name} avanzó de ${currentStage} a ${newStage}`,
        type: 'info',
        category: 'stage_advanced',
        link: `/tracker/supplier/${supplierId}`,
        excludeUserId: actor.id,
      });
    } catch (err) {
      console.error('[notify] moveSupplierToStage notification failed:', err);
    }
  });

  return getTrackerSupplier(prisma, supplierId);
}

/** Creates the stage's 1:1 satellite row if missing. */
async function ensureStageSatellite(
  tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
  supplierId: string,
  stage: TrackerStage,
) {
  switch (stage) {
    case 'Parking Lot':
      await tx.parkingData.upsert({
        where: { supplierId },
        create: { supplierId, onboardingDate: todayISO() },
        update: {},
      });
      break;
    case 'Preliminary Evaluation':
      await tx.preliminaryData.upsert({
        where: { supplierId },
        create: { supplierId, startDate: todayISO() },
        update: {},
      });
      break;
    case 'Supplier Evaluation':
      await tx.supplierEvalData.upsert({ where: { supplierId }, create: { supplierId }, update: {} });
      break;
    case 'Intelex Handoff':
      await tx.intelexData.upsert({ where: { supplierId }, create: { supplierId }, update: {} });
      break;
    default:
      break;
  }
}

/**
 * Write-side of a blacklist. Split out of `blacklistSupplier` so a caller that
 * already owns a transaction — `setParkingSubStatus` on "No Go" — can commit the
 * blacklist together with its own writes instead of opening a second one and
 * risking a supplier left "No Go" but still ACTIVE in Parking Lot.
 */
async function writeBlacklist(
  tx: Prisma.TransactionClient,
  supplier: { id: string; name: string; stageId: number; stage: { name: string } },
  blacklistedStageId: number,
  reason: string,
  actor: AuthUser,
  today: string,
) {
  // Move to terminal 'Blacklisted', preserving origin in stageBeforeExit.
  await tx.supplier.update({
    where: { id: supplier.id },
    data: {
      status: { connect: { name: 'BLACKLISTED' } },
      stage: { connect: { name: 'Blacklisted' } },
      stageBeforeExit: supplier.stage.name,
      stageEnteredAt: new Date(),
    },
  });
  await tx.blacklistEntry.create({
    data: {
      supplierId: supplier.id,
      rejectedBy: actor.displayName,
      rejectionDate: today,
      rejectionReason: reason,
    },
  });
  await tx.supplierHistoryEntry.create({
    data: {
      supplierId: supplier.id,
      date: today,
      action: 'Supplier blacklisted',
      user: actor.displayName,
      role: actor.role,
      note: reason,
      fromStageId: supplier.stageId,
      toStageId: blacklistedStageId,
    },
  });
  // Notify inside the transaction; swallow failures so notifying can't roll back the blacklist.
  try {
    await notifyTeam(tx, {
      message: `${supplier.name} fue movido a Blacklisted: ${reason}`,
      type: 'warning',
      category: 'blacklisted',
      link: `/tracker/blacklisted/supplier/${supplier.id}`,
      excludeUserId: actor.id,
    });
  } catch (err) {
    console.error('[notify] blacklistSupplier notification failed:', err);
  }
}

/** Blacklist requires a non-empty reason (business rule). */
export async function blacklistSupplier(
  prisma: PrismaClient,
  supplierId: string,
  reason: string | undefined | null,
  actor: AuthUser,
) {
  const trimmed = assertMeaningfulText(reason, 'Rejection reason');
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    include: { status: true, stage: true },
  });
  if (!supplier) throw new NotFoundError(`Supplier ${supplierId} not found`);
  if (supplier.status.name === 'BLACKLISTED') {
    throw new BusinessRuleError('Supplier is already blacklisted');
  }
  if (supplier.status.name === 'COMPLETED') {
    throw new BusinessRuleError('Completed suppliers cannot be blacklisted (terminal state)');
  }

  // Resolve the terminal 'Blacklisted' stage id for the structured history columns.
  const blacklistedStage = await prisma.stage.findUniqueOrThrow({ where: { name: 'Blacklisted' } });

  const today = todayISO();
  await prisma.$transaction(async tx => {
    await writeBlacklist(tx, supplier, blacklistedStage.id, trimmed, actor, today);
  });

  return getTrackerSupplier(prisma, supplierId);
}

/** Promotes an 'Identified' supplier to the 'B2B' phase within Scouting Event (no stage change). */
export async function promoteToB2B(
  prisma: PrismaClient,
  supplierId: string,
  actor: AuthUser,
) {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    include: { status: true, stage: true },
  });
  if (!supplier) throw new NotFoundError(`Supplier ${supplierId} not found`);
  if (supplier.status.name !== 'ACTIVE') {
    throw new BusinessRuleError('Only active suppliers can be promoted to the B2B phase');
  }
  if (supplier.stage.name !== 'Scouting Event') {
    throw new BusinessRuleError('B2B promotion applies only to suppliers in Scouting Event');
  }
  if (supplier.scoutingPhase !== 'Identified') {
    throw new BusinessRuleError(
      supplier.scoutingPhase === 'B2B'
        ? 'Supplier is already in the B2B phase'
        : 'Only suppliers in the Identified phase can be promoted to B2B',
    );
  }

  const today = todayISO();
  await prisma.$transaction(async tx => {
    await tx.supplier.update({
      where: { id: supplierId },
      data: { scoutingPhase: 'B2B' },
    });
    await tx.supplierHistoryEntry.create({
      data: {
        supplierId,
        date: today,
        action: 'Promoted to B2B phase within Scouting Event',
        user: actor.displayName,
        role: actor.role,
      },
    });
  });

  return getTrackerSupplier(prisma, supplierId);
}

/** Parking sub-status; "No Go" auto-blacklists (reason required). */
export async function setParkingSubStatus(
  prisma: PrismaClient,
  supplierId: string,
  subStatus: string,
  actor: AuthUser,
  reason?: string,
) {
  if (!SUB_STATUSES.includes(subStatus as SubStatus)) {
    throw new ValidationError(`Unknown sub-status: ${subStatus}`);
  }
  const isNoGo = subStatus === 'No Go';
  if (isNoGo && !(reason ?? '').trim()) {
    // "No Go" auto-blacklists — reason required up front.
    throw new ValidationError('A reason is required when setting sub-status to "No Go"');
  }
  // The full reason rule (the same one blacklistSupplier applies) is enforced
  // BEFORE any write, so a reason that is present but not meaningful can no
  // longer leave the supplier tagged "No Go" without the blacklist landing.
  const blacklistReason = isNoGo ? assertMeaningfulText(reason, 'Rejection reason') : '';
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    include: { status: true, stage: true },
  });
  if (!supplier) throw new NotFoundError(`Supplier ${supplierId} not found`);
  if (supplier.status.name !== 'ACTIVE') {
    throw new BusinessRuleError('Sub-status can only be changed for active suppliers');
  }
  if (supplier.stage.name !== 'Parking Lot') {
    throw new BusinessRuleError('Sub-status applies to suppliers in Parking Lot');
  }

  // Resolved before the transaction — only needed on the auto-blacklist path.
  const blacklistedStage = isNoGo
    ? await prisma.stage.findUniqueOrThrow({ where: { name: 'Blacklisted' } })
    : null;

  const today = todayISO();
  await prisma.$transaction(async tx => {
    await tx.supplier.update({
      where: { id: supplierId },
      data: { subStatus: { connect: { name: subStatus } } },
    });
    await tx.parkingData.upsert({
      where: { supplierId },
      create: { supplier: { connect: { id: supplierId } }, subStatus: { connect: { name: subStatus } } },
      update: { subStatus: { connect: { name: subStatus } } },
    });
    await tx.supplierHistoryEntry.create({
      data: {
        supplierId,
        date: today,
        action: `Sub-status changed to: ${subStatus}`,
        user: actor.displayName,
        role: actor.role,
      },
    });
    if (blacklistedStage) {
      // Automatic blacklist, in THIS transaction: the sub-status change and the
      // blacklist are one atomic effect, so a failure can't leave a supplier the
      // UI shows as rejected while the tracker still counts it as active.
      await writeBlacklist(tx, supplier, blacklistedStage.id, blacklistReason, actor, today);
    }
  });

  return getTrackerSupplier(prisma, supplierId);
}
