/**
 * Second-stage DB importer: events, event↔supplier links, B2B meetings, MRL, and the
 * history backfill that makes the Reports module work for the migrated data.
 *
 *   IMPORT_REAL_DATA=true npm run import:rest
 *
 * Runs only after import:suppliers (it links events and backfills history for the already
 * imported XL- suppliers). Same gate as SEED_DEMO — without IMPORT_REAL_DATA=true it warns
 * and exits. Idempotent and non-destructive: never deletes, upserts/guards every write.
 *
 *  Part 1  the 7 events + T_Event_SupplierEntry (one per Scouting-List row) + T_Event_B2BMeeting
 *  Part 2  the 37 Master Requirements List rows → MrlRequirement
 *  Part 3  reports the current StrategyEntry state (does NOT touch it — GSM captures those in-app)
 *  Part 4  backfills T_Supplier_History with the real transition dates from the Excel, so
 *          reportsService.getStageSnapshot() can reconstruct past dates; plus real
 *          SupplierNotes for blacklist reasons and meaningful parking comments, plus
 *          Supplier.stageEnteredAt (the anchor the live "Days in Stage" counter reads),
 *          written only where it is still null.
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import { mapCommodity, normalizeEventName, normalizeName, normalizeSpace, parseExcelDate } from './normalize';
import { assertGitIgnored } from './source-guard';
import { getStageSnapshot } from '../src/services/reportsService';
import { atNoonUTC, todayISO, TRACKER_STAGES } from '../src/domain/constants';
import { JUNK_VALUES, MIN_LENGTH } from '../src/domain/textValidation';
import { assertWritableDatabase } from '../src/config/testDatabaseGuard';

const OUT = path.join(__dirname, 'output');
const SRC = path.join(__dirname, 'source');
const TODAY = todayISO();
const YEAR = new Date().getFullYear();
const XL_PREFIX = `XL-SSD-${YEAR}-`;
const JULY_EVENT = "Mexico's Nearshoring & Logistics Auto Industry Summit 2026";

const prisma = new PrismaClient();

// ── generic helpers ─────────────────────────────────────────────────────────
function wsOf(file: string, name: string): XLSX.WorkSheet {
  const src = path.join(SRC, file);
  assertGitIgnored(src);
  const wb = XLSX.readFile(src, { cellDates: true });
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Sheet "${name}" not found in ${file}`);
  return ws;
}
function cell(ws: XLSX.WorkSheet, row: number, col: number): unknown {
  const c = ws[XLSX.utils.encode_cell({ r: row - 1, c: col })];
  return c ? c.v : undefined;
}
function str(ws: XLSX.WorkSheet, row: number, col: number): string {
  return normalizeSpace(cell(ws, row, col));
}
/** Excel time-only cell → 'HH:MM' (UTC), or '' when absent/epoch. */
function timeOf(v: unknown): string {
  if (!(v instanceof Date) || Number.isNaN(v.getTime())) return '';
  const hh = String(v.getUTCHours()).padStart(2, '0');
  const mm = String(v.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
/** Mirrors assertMeaningfulText WITHOUT throwing: returns the trimmed text if it is real
 *  (≥ MIN_LENGTH chars, not a junk value), else null. Never invents text. The rule and
 *  its junk list come from domain/textValidation so the two cannot drift apart. */
function meaningful(text: unknown): string | null {
  const t = String(text ?? '').trim();
  if (t.length < MIN_LENGTH) return null;
  if (JUNK_VALUES.has(t.toLowerCase())) return null;
  return t;
}
function cut(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

// ═══════════════════════════════════════════════════════════════════════════
// PART 1 — events
// ═══════════════════════════════════════════════════════════════════════════
interface EventRef { id: string; dateStart: string; }

async function importEvents(): Promise<{ byName: Map<string, EventRef>; created: number; reused: number }> {
  const events = JSON.parse(fs.readFileSync(path.join(OUT, 'events.json'), 'utf8')) as Record<string, unknown>[];
  // "Stand" (Y / Visit) has no T_Event column — read it from the Agenda sheet to
  // prepend to description so the datum isn't lost.
  const agenda = wsOf('Scouting_Event_-_B2B_Meetings.xlsx', 'Scouting Events Agenda');
  const standByName = new Map<string, string>();
  for (let r = 5; r <= 11; r++) {
    const name = str(agenda, r, 2); // C
    if (name) standByName.set(name, str(agenda, r, 3)); // D Stand
  }
  const directCat = await prisma.productCategory.findFirst({ where: { name: 'Direct' } });
  if (!directCat) throw new Error("ProductCategory 'Direct' not seeded");

  const byName = new Map<string, EventRef>();
  let created = 0;
  let reused = 0;
  let i = 0;
  for (const e of events) {
    i += 1;
    const name = String(e.name);
    const dateStart = String(e.dateStart ?? '');
    const dateEnd = String(e.dateEnd ?? '');
    const existing = await prisma.event.findFirst({ where: { name } });
    if (existing) {
      byName.set(name, { id: existing.id, dateStart: existing.dateStart });
      reused += 1;
      continue;
    }
    const stand = standByName.get(name) ?? '';
    // status per the prompt: end before today → Completed, otherwise Upcoming.
    const status = dateEnd && dateEnd < TODAY ? 'Completed' : 'Upcoming';
    const id = `xl-evt-${String(i).padStart(2, '0')}`;
    await prisma.event.create({
      data: {
        id,
        name,
        dateStart,
        dateEnd,
        location: String(e.location ?? ''),
        organizer: '', // GSM fills these in-app later
        contactName: (e.contactName as string) ?? null,
        contactEmail: (e.contactEmail as string) ?? null,
        contactPhone: (e.contactPhone as string) ?? null,
        status,
        // "[Stand: <v>] " prefix keeps the Excel Stand column; the rest is captured in-app.
        description: stand ? `[Stand: ${stand}] ` : '',
        productCategoryId: directCat.id,
        objective: '',
        topCountry: '',
      },
    });
    byName.set(name, { id, dateStart });
    created += 1;
  }
  return { byName, created, reused };
}

// ── supplier index: normalized name → the DB suppliers that share it ─────────
interface SupIdx { id: string; onboardingDate: string; }
async function loadSupplierIndex(): Promise<Map<string, SupIdx[]>> {
  const rows = await prisma.supplier.findMany({
    where: { folio: { startsWith: XL_PREFIX } },
    select: { id: true, name: true, onboardingDate: true },
  });
  const idx = new Map<string, SupIdx[]>();
  for (const r of rows) {
    const key = normalizeName(r.name);
    const arr = idx.get(key) ?? [];
    arr.push({ id: r.id, onboardingDate: r.onboardingDate });
    idx.set(key, arr);
  }
  return idx;
}
/** The parser's tie-break: same normalized name → the oldest onboarding date (empty last). */
function pickOldest(cands: SupIdx[]): SupIdx {
  return cands.slice().sort((a, b) => {
    if (!a.onboardingDate && !b.onboardingDate) return 0;
    if (!a.onboardingDate) return 1;
    if (!b.onboardingDate) return -1;
    return a.onboardingDate < b.onboardingDate ? -1 : a.onboardingDate > b.onboardingDate ? 1 : 0;
  })[0];
}

// ── Part 1b: Scouting List → event entries + B2B meetings ────────────────────
async function importEventLinks(byName: Map<string, EventRef>, idx: Map<string, SupIdx[]>) {
  const ws = wsOf('Scouting_Event_-_B2B_Meetings.xlsx', 'Scouting List');
  // For the history backfill: each supplier's EARLIEST linked event start date.
  const supplierEventDate = new Map<string, string>();

  // Skip meetings for events that already have some (idempotency, no natural key).
  const eventsWithMeetings = new Set<string>();
  for (const ref of byName.values()) {
    if (await prisma.eventB2BMeeting.count({ where: { eventId: ref.id } }) > 0) eventsWithMeetings.add(ref.id);
  }

  let entries = 0;
  let meetings = 0;
  let unmatched = 0;
  let unmatchedEvent = 0;
  for (let r = 5; r <= 424; r++) {
    const name = str(ws, r, 4); // E Company Name
    if (!name) continue;
    // Normalize the sheet's event label to the canonical Agenda name ('CAPIM 2026' →
    // 'CAPIM', 'Automotive Meeting Queretaro' → 'Automotive Meetings Querétaro').
    const eventName = normalizeEventName(cell(ws, r, 2)); // C
    const ref = byName.get(eventName);
    if (!ref) { unmatchedEvent += 1; continue; } // event not among the 7 (shouldn't happen)
    const cands = idx.get(normalizeName(name));
    if (!cands || cands.length === 0) { unmatched += 1; continue; }
    const sup = pickOldest(cands);

    // Track earliest event date for this supplier (for the Scouting-Event birth date).
    const prev = supplierEventDate.get(sup.id);
    if (!prev || ref.dateStart < prev) supplierEventDate.set(sup.id, ref.dateStart);

    const isJuly = eventName === JULY_EVENT;
    const b2bMeeting = isJuly ? false : /^yes$/i.test(str(ws, r, 11)); // L
    const status = isJuly ? 'Accepted' : normStatus(str(ws, r, 16));    // Q
    const result = isJuly ? 'Not Included' : normResult(str(ws, r, 24)); // Y

    await prisma.eventSupplierEntry.upsert({
      where: { eventId_supplierId: { eventId: ref.id, supplierId: sup.id } },
      create: { eventId: ref.id, supplierId: sup.id, b2bMeeting, status, result },
      update: { b2bMeeting, status, result },
    });
    entries += 1;

    // B2B meeting only for rows carrying agenda data, and only if not already imported.
    const scheduled = parseExcelDate(cell(ws, r, 18)); // S Scheduled Date
    const startT = timeOf(cell(ws, r, 21)); // V
    const endT = timeOf(cell(ws, r, 22)); // W
    const stand = str(ws, r, 20); // U
    const duration = str(ws, r, 23); // X
    const hasAgenda = !!(scheduled || startT || endT || (stand && stand !== '-') || duration);
    if (hasAgenda && !eventsWithMeetings.has(ref.id) && !isJuly) {
      const time = startT && endT ? `${startT} – ${endT}` : startT || (scheduled ?? '');
      await prisma.eventB2BMeeting.create({
        data: {
          eventId: ref.id,
          supplierId: sup.id,
          time: cut(time, 30),
          stand: cut(stand, 50),
          companyName: cut(name, 200),
          commodity: cut(mapCommodity(cell(ws, r, 6)).commodity, 100), // G
          attendeeManager: cut(str(ws, r, 13), 100), // N
          attendeeBuyer: cut(str(ws, r, 14), 100), // O
          duration: cut(duration, 20),
          status,
        },
      });
      meetings += 1;
    }
  }
  return { entries, meetings, unmatched, unmatchedEvent, supplierEventDate };
}
function normStatus(v: string): string {
  const s = v.toLowerCase();
  if (s.startsWith('reject')) return 'Rejected';
  if (s.startsWith('cancel')) return 'Cancelled';
  return 'Accepted';
}
function normResult(v: string): string {
  return /^included$/i.test(v.trim()) ? 'Included' : 'Not Included';
}

// ═══════════════════════════════════════════════════════════════════════════
// PART 2 — MRL
// ═══════════════════════════════════════════════════════════════════════════
async function importMrl() {
  const rows = JSON.parse(fs.readFileSync(path.join(OUT, 'mrl.json'), 'utf8')) as Record<string, unknown>[];
  const commodityIds = new Map((await prisma.commodity.findMany()).map(c => [c.name, c.id]));
  let created = 0;
  let skipped = 0;
  const missing: string[] = [];
  let i = 0;
  for (const m of rows) {
    i += 1;
    const id = `xl-mrl-${String(i).padStart(4, '0')}`;
    if (await prisma.mrlRequirement.findUnique({ where: { id } })) { skipped += 1; continue; }
    const commodityId = commodityIds.get(String(m.commodity));
    if (!commodityId) { missing.push(`${id} (${m.commodity})`); continue; }
    const vol = m.volumeByYear as Record<string, number | null>;
    await prisma.mrlRequirement.create({
      data: {
        id,
        buyerName: cut(String(m.buyerName ?? ''), 100),
        commodityId,
        // NOT NULL columns the Excel leaves blank → '' (never a fake value).
        nexteerProductLine: cut(String(m.nexteerProductLine ?? ''), 50),
        vol2026: vol?.['2026'] ?? null, vol2027: vol?.['2027'] ?? null, vol2028: vol?.['2028'] ?? null,
        vol2029: vol?.['2029'] ?? null, vol2030: vol?.['2030'] ?? null, vol2031: vol?.['2031'] ?? null,
        partNumber: cut(String(m.partNumber ?? ''), 100),
        partDescription: cut(String(m.partDescription ?? ''), 300),
        mainMaterialsSpecTech: cut(String(m.mainMaterialsSpecTech ?? ''), 500),
        peakVolume: (m.peakVolume as number | null) ?? null,
        program: cut(String(m.program ?? ''), 100),
        eop: cut(String(m.eop ?? ''), 20),
        targetPrice: (m.targetPrice as number | null) ?? null, // '$' → null (parser fix)
        priority: (m.priority as number | null) ?? 2,           // Int NOT NULL, default 2
        primaryDriver: cut(String(m.primaryDriver ?? ''), 100),
        keyManufacturingCapabilities: cut(String(m.keyManufacturingCapabilities ?? ''), 500),
        safetyCriticalPart: !!m.safetyCriticalPart,
        supplierExperienceInSafetyRequired: !!m.supplierExperienceInSafetyRequired,
        certifications: cut(String(m.certifications ?? ''), 300),
        knowsCQIs: !!m.knowsCQIs,
      },
    });
    created += 1;
  }
  return { created, skipped, missing };
}

// ═══════════════════════════════════════════════════════════════════════════
// PART 3 — strategy (report only, never touched)
// ═══════════════════════════════════════════════════════════════════════════
async function reportStrategy() {
  const entries = await prisma.strategyEntry.findMany({ include: { commodity: { select: { name: true } } } });
  return { count: entries.length, commodities: entries.map(e => e.commodity.name).sort() };
}

// ═══════════════════════════════════════════════════════════════════════════
// PART 4 — history backfill + notes
// ═══════════════════════════════════════════════════════════════════════════
// The 5 ACTIVE stages in order, taken from the domain list rather than re-typed:
// TRACKER_STAGES ends with the two terminal stages ('Blacklisted', 'Completed'),
// which are exits, not steps, and are handled separately by resolveStage().
const STAGE_ORDER: string[] = TRACKER_STAGES.slice(0, 5);

/**
 * `stageEnteredAt` for suppliers whose current stage is **Supplier Evaluation**.
 *
 * Hardcoded, not `todayISO()`, on purpose: the Excel has no per-station date for
 * this stage, so `buildTimeline()` estimates it from the Pre-Evaluation start
 * date — a date that can be many months old and would show a fabricated,
 * inflated "Days in Stage" from day one. What is actually true of these rows is
 * that they arrived in the system on the day the real import ran (2026-07-24,
 * commit c23fed5), so that is the honest clock start. A dynamic TODAY would
 * instead reset the counter to 0 on every re-run, which is worse: the number
 * would silently lie about a stage the supplier has been sitting in for weeks.
 */
const SUPPLIER_EVAL_IMPORT_ANCHOR = '2026-07-24';


interface JsonSupplier {
  name: string; commodity: string; entrySource: string; stage: string; status: string;
  stageBeforeExit: string | null; onboardingDate: string;
  parkingOnboardingDate: string | null; preEvalStartDate: string | null;
  intelex_recordCreationDate: string | null; rejectionDate?: string; rejectionReason?: string;
  parkingAdditionalComments: string | null; _excelSources?: string[];
}
interface Transition { stage: string; date: string; note: string | null; action: string; estimated?: boolean; }

/** Build the chronological stage timeline for a supplier from its Excel dates. */
function buildTimeline(s: JsonSupplier, eventDate: string | undefined): Transition[] {
  const peak = s.status === 'BLACKLISTED' ? (s.stageBeforeExit ?? 'Scouting Event') : s.stage;
  const peakIdx = Math.max(0, STAGE_ORDER.indexOf(peak));
  const firstIdx = s.entrySource === 'Scouting Event' ? 0 : 1; // Recommendation is born at Parking Lot

  const ownDate = (stage: string): string | null => {
    switch (stage) {
      // A supplier registered for a FUTURE event entered Scouting when it was captured,
      // not on the (future) event date — cap at today so it shows in the current pipeline.
      case 'Scouting Event':
        if (eventDate) return eventDate <= TODAY ? eventDate : TODAY;
        return s.onboardingDate || null;
      case 'Parking Lot': return s.parkingOnboardingDate;
      case 'Preliminary Evaluation': return s.preEvalStartDate;
      case 'Supplier Evaluation': return s.preEvalStartDate; // estimated — no own date in Excel
      case 'Intelex Handoff': return s.intelex_recordCreationDate;
      default: return null;
    }
  };

  const out: Transition[] = [];
  let prevDate = '';
  for (let i = firstIdx; i <= peakIdx; i++) {
    const stage = STAGE_ORDER[i];
    let d = ownDate(stage) || prevDate || s.onboardingDate || TODAY;
    if (prevDate && d < prevDate) d = prevDate; // keep monotonic
    const estimated = stage === 'Supplier Evaluation';
    out.push({
      stage,
      date: d,
      note: stage === 'Parking Lot' ? meaningful(s.parkingAdditionalComments) : null,
      action: i === firstIdx
        ? '' // birth action set by caller (carries the Excel origin)
        : `Moved to ${stage}${estimated ? ' (fecha estimada — sin fecha propia en el Excel, se usa Pre-Evaluation Start Date)' : ''}`,
      estimated,
    });
    prevDate = d;
  }
  if (s.status === 'BLACKLISTED') {
    let d = s.rejectionDate || prevDate || s.onboardingDate || TODAY;
    if (prevDate && d < prevDate) d = prevDate;
    out.push({ stage: 'Blacklisted', date: d, note: meaningful(s.rejectionReason), action: 'Blacklisted (imported from Excel)' });
  }
  return out;
}

async function backfillHistory(supplierEventDate: Map<string, string>) {
  const json = JSON.parse(fs.readFileSync(path.join(OUT, 'suppliers.json'), 'utf8')) as JsonSupplier[];
  // Map (name||commodity) → the JSON record, to enrich each DB supplier with its dates.
  const jsonByKey = new Map(json.map(s => [`${s.name}||${s.commodity}`, s]));

  const dbSuppliers = await prisma.supplier.findMany({
    where: { folio: { startsWith: XL_PREFIX } },
    select: { id: true, name: true, stageEnteredAt: true, commodity: { select: { name: true } } },
  });
  const stages = new Map((await prisma.stage.findMany()).map(s => [s.name, s.id]));

  let backfilled = 0;
  let alreadyDone = 0;
  let notes = 0;
  let stageAnchored = 0;
  for (const db of dbSuppliers) {
    const s = jsonByKey.get(`${db.name}||${db.commodity.name}`);
    if (!s) continue;

    // The birth entry is the "Imported from Excel — origen:" row import:suppliers created.
    const birth = await prisma.supplierHistoryEntry.findFirst({
      where: { supplierId: db.id, action: { startsWith: 'Imported from Excel' } },
      orderBy: { id: 'asc' },
    });
    // Idempotency: once that row has a toStageId, this supplier is already backfilled.
    if (birth && birth.toStageId != null) { alreadyDone += 1; continue; }

    const timeline = buildTimeline(s, supplierEventDate.get(db.id));
    if (timeline.length === 0) continue;

    await prisma.$transaction(async tx => {
      // 1) birth: the first stage, at the earliest known date, keeps the origin action.
      const first = timeline[0];
      const originAction = birth?.action ?? `Imported from Excel — origen: ${(s._excelSources ?? []).join('; ')}`;
      if (birth) {
        await tx.supplierHistoryEntry.update({
          where: { id: birth.id },
          data: { date: first.date, fromStageId: null, toStageId: stages.get(first.stage)! },
        });
      } else {
        await tx.supplierHistoryEntry.create({
          data: {
            supplierId: db.id, date: first.date, action: cut(originAction, 500),
            user: 'Excel Import', role: 'SSD', fromStageId: null, toStageId: stages.get(first.stage)!,
          },
        });
      }
      // 2) each subsequent transition.
      for (let i = 1; i < timeline.length; i++) {
        const t = timeline[i];
        const from = timeline[i - 1].stage;
        await tx.supplierHistoryEntry.create({
          data: {
            supplierId: db.id, date: t.date, action: cut(t.action, 500),
            user: 'Excel Import', role: 'SSD',
            fromStageId: stages.get(from) ?? null, toStageId: stages.get(t.stage)!,
            note: t.note ? cut(t.note, 500) : null,
          },
        });
      }
      // 2b) Neutralize the "Demo supplier seeded" row seedSupplier appends (dated today,
      //     toStage = current stage). Now that the real timeline exists it is redundant and,
      //     worse, would show as a bogus "moved today" in every weekly Reports diff. Keep the
      //     row (no delete) but null its toStageId so it is neither a movement nor a stage
      //     definer, and relabel it truthfully.
      await tx.supplierHistoryEntry.updateMany({
        where: { supplierId: db.id, action: 'Demo supplier seeded' },
        data: { toStageId: null, action: 'Import baseline — estado actual (sin transición de etapa)' },
      });
      // 3) real SupplierNotes (panel + Reports) for meaningful reasons/comments, dated
      //    at the movement (createdAt too, so weekly diffs land in the right window).
      for (const t of timeline) {
        if (!t.note) continue;
        const noteStage = t.stage === 'Blacklisted' ? (s.stageBeforeExit ?? 'Scouting Event') : t.stage;
        const kind = t.stage === 'Blacklisted' ? 'blacklist' : 'parking';
        await tx.supplierNote.create({
          data: {
            id: `${db.id}-xlnote-${kind}`,
            supplierId: db.id,
            text: cut(t.note, 2000),
            author: 'Excel Import',
            role: 'SSD',
            date: t.date,
            stageId: stages.get(noteStage)!,
            createdAt: atNoonUTC(t.date),
          },
        });
        notes += 1;
      }
      // 4) Supplier.stageEnteredAt — the anchor the live "Days in Stage" counter and
      //    the SLA colour read (domain/sla.ts). The timeline already knows the real
      //    date the supplier moved into its current stage, but until now that date
      //    only reached T_Supplier_History. Written ONLY when the column is still
      //    null: a value already there is either correct or a manual correction, and
      //    overwriting it would restart someone's clock.
      if (db.stageEnteredAt == null) {
        // Same 'Blacklisted' exclusion as the notes above: a blacklisted supplier's
        // current *stage* is the last one it actually sat in, not the exit marker.
        const lastActive = [...timeline].reverse().find(t => t.stage !== 'Blacklisted');
        if (lastActive) {
          const enteredAt = lastActive.stage === 'Supplier Evaluation'
            ? SUPPLIER_EVAL_IMPORT_ANCHOR // estimated timeline date would inflate the counter
            : lastActive.date;
          await tx.supplier.update({
            where: { id: db.id },
            data: { stageEnteredAt: atNoonUTC(enteredAt) },
          });
          stageAnchored += 1;
        }
      }
    });
    backfilled += 1;
  }
  return { backfilled, alreadyDone, notes, stageAnchored };
}

// ═══════════════════════════════════════════════════════════════════════════
// Verification
// ═══════════════════════════════════════════════════════════════════════════
async function snapshotByStage(asOf: string): Promise<Record<string, number>> {
  const rows = await getStageSnapshot(prisma, asOf);
  const byStage: Record<string, number> = {};
  for (const r of rows) byStage[r.stageName] = (byStage[r.stageName] ?? 0) + r.count;
  return byStage;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════
function writeLog(lines: string[]) {
  fs.writeFileSync(path.join(OUT, 'import-rest-log.md'), lines.join('\n'), 'utf8');
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  if (process.env.IMPORT_REAL_DATA !== 'true') {
    console.warn(
      '\n[import:rest] ⚠ IMPORT_REAL_DATA no está en "true" — no se importó nada.\n' +
      '[import:rest]   Para ejecutarlo: IMPORT_REAL_DATA=true npm run import:rest\n',
    );
    writeLog(['# Log import:rest', '', '> No se ejecutó (IMPORT_REAL_DATA != true).']);
    return;
  }

  // Same reasoning as import-suppliers.ts: the env flag says "I want the import",
  // not "I am pointed at the right database".
  assertWritableDatabase('[import:rest]');

  console.log('[import:rest] Parte 1 — eventos…');
  const ev = await importEvents();
  const links = await importEventLinks(ev.byName, await loadSupplierIndex());
  console.log(`[import:rest]   eventos: ${ev.created} creados, ${ev.reused} reusados`);
  console.log(`[import:rest]   event-supplier entries: ${links.entries} (proveedor sin match: ${links.unmatched}, evento sin match: ${links.unmatchedEvent})  ·  B2B meetings: ${links.meetings}`);

  console.log('[import:rest] Parte 2 — MRL…');
  const mrl = await importMrl();
  console.log(`[import:rest]   MRL: ${mrl.created} creadas, ${mrl.skipped} ya existían${mrl.missing.length ? `, ${mrl.missing.length} sin commodity` : ''}`);

  console.log('[import:rest] Parte 3 — strategy (solo reporte)…');
  const strat = await reportStrategy();
  console.log(`[import:rest]   StrategyEntry actuales: ${strat.count} → commodities: ${strat.commodities.join(', ') || '(ninguna)'}`);
  console.log('[import:rest]   (No se tocan — GSM captura las necesidades reales desde el módulo Strategy.)');

  console.log('[import:rest] Parte 4 — backfill de historial…');
  const bf = await backfillHistory(links.supplierEventDate);
  console.log(`[import:rest]   proveedores con historial reconstruido: ${bf.backfilled} (ya estaban: ${bf.alreadyDone})  ·  SupplierNotes: ${bf.notes}`);
  console.log(`[import:rest]   stageEnteredAt fijado (estaba null): ${bf.stageAnchored}`);

  console.log('\n──────── Verificación getStageSnapshot (conteo por etapa) ────────');
  const dates = ['2026-03-01', '2026-05-01', TODAY];
  const snaps: Record<string, Record<string, number>> = {};
  for (const d of dates) {
    snaps[d] = await snapshotByStage(d);
    const total = Object.values(snaps[d]).reduce((a, b) => a + b, 0);
    console.log(`  ${d}  (total ${total}):`, JSON.stringify(snaps[d]));
  }

  const log: string[] = [];
  log.push('# Log import:rest — eventos, MRL, strategy, backfill de historial');
  log.push('');
  log.push(`Generado: ${new Date().toISOString()}`);
  log.push('');
  log.push('## Parte 1 — Eventos');
  log.push(`- Eventos: ${ev.created} creados, ${ev.reused} reusados`);
  log.push(`- T_Event_SupplierEntry: ${links.entries} (filas Scouting sin match: ${links.unmatched})`);
  log.push(`- T_Event_B2BMeeting: ${links.meetings}`);
  log.push('');
  log.push('## Parte 2 — MRL');
  log.push(`- MrlRequirement: ${mrl.created} creadas, ${mrl.skipped} ya existían` + (mrl.missing.length ? `, sin commodity: ${mrl.missing.join(', ')}` : ''));
  log.push('');
  log.push('## Parte 3 — Strategy (no modificada)');
  log.push(`- StrategyEntry actuales: **${strat.count}** para commodities: ${strat.commodities.join(', ') || '(ninguna)'}`);
  log.push('- GSM capturará las necesidades reales desde el módulo Strategy (edición inline).');
  log.push('');
  log.push('## Parte 4 — Backfill de historial');
  log.push(`- Proveedores reconstruidos: ${bf.backfilled} (ya estaban: ${bf.alreadyDone})`);
  log.push(`- SupplierNotes creadas (razones de blacklist / comentarios de parking): ${bf.notes}`);
  log.push(`- \`stageEnteredAt\` fijado (solo donde estaba null): **${bf.stageAnchored}** — ancla del contador`);
  log.push(`  "Days in Stage" en vivo. Los de **Supplier Evaluation** usan \`${SUPPLIER_EVAL_IMPORT_ANCHOR}\``);
  log.push('  (fecha real de la importación) en vez de la fecha estimada del timeline, que inflaría el conteo.');
  log.push('');
  log.push('## Verificación — getStageSnapshot por etapa');
  log.push('');
  log.push('| Fecha | ' + STAGE_ORDER.join(' | ') + ' | Total |');
  log.push('|---|' + STAGE_ORDER.map(() => '--:').join('|') + '|--:|');
  for (const d of dates) {
    const row = STAGE_ORDER.map(st => snaps[d][st] ?? 0);
    log.push(`| ${d} | ${row.join(' | ')} | ${row.reduce((a, b) => a + b, 0)} |`);
  }
  log.push('');
  log.push('> Progresión esperada: fechas más antiguas → menos proveedores y concentrados en');
  log.push('> etapas tempranas. Reconstruido desde T_Supplier_History (fechas reales del Excel).');
  writeLog(log);

  console.log(`\n[import:rest] done ✔  log → ${path.join(OUT, 'import-rest-log.md')}`);
}

main()
  .catch(err => {
    console.error('[import:rest] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
