import type { PrismaClient } from '@prisma/client';
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_CONFIG,
  SUB_STATUSES,
  stageIndex,
  todayISO,
  type PipelineStage,
  type SubStatus,
} from '../domain/constants';
import { BusinessRuleError, NotFoundError, ValidationError } from '../domain/errors';
import { supplierInclude, toSupplierDTO } from '../mappers/supplierMapper';
import type { AuthUser } from '../middleware/auth';

export function getStageConfig() {
  return PIPELINE_STAGE_CONFIG;
}

/** Suppliers currently in the pipeline (ACTIVE + COMPLETED), grouped consumers filter by stage. */
export async function listByStage(prisma: PrismaClient, stage?: string) {
  if (stage !== undefined && !PIPELINE_STAGES.includes(stage as PipelineStage)) {
    throw new ValidationError(`Unknown stage: ${stage}`);
  }
  const rows = await prisma.supplier.findMany({
    where: {
      status: { is: { name: { in: ['ACTIVE', 'COMPLETED'] } } },
      // Direct Material only on the pipeline board — Indirect is filtered out,
      // not a parallel flow (business rule).
      productCategory: { is: { name: 'Direct' } },
      ...(stage ? { stage: { is: { name: stage } } } : {}),
    },
    include: supplierInclude,
    orderBy: { folio: 'asc' },
  });
  return rows.map(toSupplierDTO);
}

export async function getPipelineSupplier(prisma: PrismaClient, id: string) {
  const row = await prisma.supplier.findUnique({ where: { id }, include: supplierInclude });
  if (!row) throw new NotFoundError(`Supplier ${id} not found`);
  return toSupplierDTO(row);
}

/**
 * Stage transition rules:
 *  - target must be a known stage
 *  - BLACKLISTED / COMPLETED suppliers cannot move (terminal states)
 *  - backward moves are rejected (stageIndex(newStage) must be >= current stage)
 *  - 'Completed' can only be entered from 'Intelex Handoff'
 *  - forward movement between the 5 working stages is otherwise free (Kanban).
 */
export async function moveSupplierToStage(
  prisma: PrismaClient,
  supplierId: string,
  newStage: string,
  actor: AuthUser,
) {
  if (!PIPELINE_STAGES.includes(newStage as PipelineStage)) {
    throw new ValidationError(`Unknown stage: ${newStage}`);
  }
  // 'Blacklisted' is a known stage but not a valid /move target — blacklisting
  // must go through the dedicated endpoint (which enforces the mandatory reason).
  if (newStage === 'Blacklisted') {
    throw new BusinessRuleError('Use the blacklist endpoint to blacklist a supplier');
  }
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    include: { status: true, stage: true },
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

  const today = todayISO();
  await prisma.$transaction(async tx => {
    await tx.supplier.update({
      where: { id: supplierId },
      data: {
        stage: { connect: { name: newStage } },
        daysInStage: 0,
        // Exiting to a terminal state records where the supplier came from.
        ...(newStage === 'Completed'
          ? { status: { connect: { name: 'COMPLETED' } }, stageBeforeExit: currentStage }
          : {}),
      },
    });
    if (newStage === 'Completed') {
      await tx.completionEntry.create({
        data: { supplierId, completedDate: today, completedBy: actor.displayName },
      });
    } else {
      await ensureStageSatellite(tx, supplierId, newStage as PipelineStage);
    }
    await tx.supplierHistoryEntry.create({
      data: {
        supplierId,
        date: today,
        action: `Moved from ${currentStage} to ${newStage}`,
        user: actor.displayName,
        role: actor.role,
      },
    });
  });

  return getPipelineSupplier(prisma, supplierId);
}

/** Creates the 1:1 satellite row for a stage if it doesn't exist yet. */
async function ensureStageSatellite(
  tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
  supplierId: string,
  stage: PipelineStage,
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

/** Blacklist requires a non-empty reason — rejected otherwise (business rule). */
export async function blacklistSupplier(
  prisma: PrismaClient,
  supplierId: string,
  reason: string | undefined | null,
  actor: AuthUser,
) {
  const trimmed = (reason ?? '').trim();
  if (!trimmed) {
    throw new ValidationError('A rejection reason is required to blacklist a supplier');
  }
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

  const today = todayISO();
  await prisma.$transaction(async tx => {
    // Move to the terminal 'Blacklisted' stage, preserving the origin stage in
    // stageBeforeExit (the mapper surfaces the origin back to the frontend).
    await tx.supplier.update({
      where: { id: supplierId },
      data: {
        status: { connect: { name: 'BLACKLISTED' } },
        stage: { connect: { name: 'Blacklisted' } },
        stageBeforeExit: supplier.stage.name,
      },
    });
    await tx.blacklistEntry.create({
      data: {
        supplierId,
        rejectedBy: actor.displayName,
        rejectionDate: today,
        rejectionReason: trimmed,
      },
    });
    await tx.supplierHistoryEntry.create({
      data: {
        supplierId,
        date: today,
        action: 'Supplier blacklisted',
        user: actor.displayName,
        role: actor.role,
        note: trimmed,
      },
    });
  });

  return getPipelineSupplier(prisma, supplierId);
}

/**
 * Parking Lot sub-status. "No Go" implies automatic blacklisting and therefore
 * requires a reason (business rule).
 */
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
  if (subStatus === 'No Go' && !(reason ?? '').trim()) {
    // "No Go" auto-blacklists, so the mandatory-reason rule applies up front.
    throw new ValidationError('A reason is required when setting sub-status to "No Go"');
  }
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
  });

  if (subStatus === 'No Go') {
    // Automatic blacklist — reuses the mandatory-reason rule.
    return blacklistSupplier(prisma, supplierId, reason, actor);
  }
  return getPipelineSupplier(prisma, supplierId);
}
