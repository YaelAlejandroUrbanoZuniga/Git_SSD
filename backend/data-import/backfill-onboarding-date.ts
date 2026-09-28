/**
 * One-time catch-up: fill Supplier.OnboardingDate for suppliers that have it empty
 * ('' or whitespace-only).
 *
 *   BACKFILL_ONBOARDING_DATE=true npm run import:backfill-onboarding
 *
 * WHY THIS EXISTS. The column is NOT NULL, so parse.ts wrote `''` for every supplier
 * with no parkingOnboardingDate, preEvalStartDate, rejectionDate or sort date in the
 * Excel — in practice the suppliers still sitting in Scouting Event. Visuals
 * (frontend Dashboard.tsx → filterByDate) keys every period on `onboardingDate`, so
 * an empty value can never fall inside any range: those suppliers are counted as
 * "undated" and silently left out of every chart and of the Summary by Buyer.
 * Rows created through the app always have it (createSupplier stamps today), and
 * the real import ALREADY RAN on 2026-07-24, so this is a retroactive pass over
 * data that already exists.
 *
 * WHAT IT DOES. For every supplier (any status, any folio) whose `onboardingDate`
 * is empty it takes, in order:
 *   1. `stageEnteredAt` (already backfilled by backfill-stage-entered-at.ts, and for
 *      Scouting Event usually the real scouting event date — see import-rest.ts
 *      buildTimeline) — UNLESS the supplier has an earlier T_Supplier_History entry:
 *      a supplier cannot have onboarded after its own first recorded history row, and
 *      for anyone past their entry stage `stageEnteredAt` is a later transition
 *      (e.g. the day it was blacklisted), not its onboarding;
 *   2. the earliest T_Supplier_History `date` for that supplier;
 *   3. the literal 2026-07-24 import anchor, logged as an ESTIMATE.
 * It never uses today: a dynamic "now" would make historically imported suppliers
 * look like they onboarded this week and inflate the "This year" figures.
 *
 * SAFE TO RE-RUN. It only ever writes rows where the column is empty, so a second
 * run is a no-op. It writes nothing else. TEST database only (MX_MFGIT_SSD_TEST) —
 * enforced by assertWritableDatabase.
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { assertWritableDatabase } from '../src/config/testDatabaseGuard';

const OUT = path.join(__dirname, 'output');
const LOG_FILE = 'backfill-onboarding-date-log.md';

/**
 * Same value and same justification as SUPPLIER_EVAL_IMPORT_ANCHOR in
 * backfill-stage-entered-at.ts / import-rest.ts: the date the real Excel import ran.
 * Kept as a literal rather than a dynamic TODAY so a later re-run cannot stamp these
 * suppliers as onboarded "this week". It is also the date import-rest.ts's
 * buildTimeline fell back to (its TODAY) for scouting suppliers with no event date,
 * so a value from sources 1–2 that equals it is flagged as a probable estimate too.
 */
const ONBOARDING_IMPORT_ANCHOR = '2026-07-24';

type Source = 'stageEnteredAt' | 'history' | 'anchor-estimate';
const SOURCES: Source[] = ['stageEnteredAt', 'history', 'anchor-estimate'];

const DAY = /^\d{4}-\d{2}-\d{2}/;

/** Leading 'YYYY-MM-DD' of a history `date` string; null when it is not a date. */
function dayOf(raw: string | null | undefined): string | null {
  return DAY.exec(raw?.trim() ?? '')?.[0] ?? null;
}

function writeLog(lines: string[]) {
  fs.writeFileSync(path.join(OUT, LOG_FILE), lines.join('\n'), 'utf8');
}

interface Fixed { folio: string; name: string; stage: string; old: string; date: string; source: Source; estimate: boolean; }

const prisma = new PrismaClient();

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  if (process.env.BACKFILL_ONBOARDING_DATE !== 'true') {
    console.warn(
      '\n[backfill:onboarding] ⚠ BACKFILL_ONBOARDING_DATE no está en "true" — no se tocó nada.\n' +
      '[backfill:onboarding]   Para ejecutarlo: BACKFILL_ONBOARDING_DATE=true npm run import:backfill-onboarding\n',
    );
    writeLog(['# Log backfill onboardingDate', '', '> No se ejecutó (BACKFILL_ONBOARDING_DATE != true).']);
    return;
  }

  assertWritableDatabase('[backfill:onboarding]');

  // Whitespace-only can't be expressed in a Prisma `where`, and the table is a few
  // hundred rows — read the column for all suppliers and filter here.
  const suppliers = await prisma.supplier.findMany({
    select: { id: true, folio: true, name: true, onboardingDate: true, stageEnteredAt: true, stage: { select: { name: true } } },
    orderBy: { folio: 'asc' },
  });
  const pending = suppliers.filter(s => !s.onboardingDate.trim());
  console.log(`[backfill:onboarding] proveedores con onboardingDate vacío: ${pending.length}`);

  // Earliest history `date` per supplier. `date` is a 'YYYY-MM-DD' string, which
  // sorts chronologically, so _min is the earliest day.
  const earliest = await prisma.supplierHistoryEntry.groupBy({
    by: ['supplierId'],
    where: { supplierId: { in: pending.map(s => s.id) } },
    _min: { date: true },
  });
  const earliestBySupplier = new Map(earliest.map(e => [e.supplierId, dayOf(e._min.date)]));

  const fixed: Fixed[] = [];
  for (const s of pending) {
    // Same UTC reading the rest of the backend uses (todayISO): stageEnteredAt is
    // stamped at noon UTC for day-precision dates, so the UTC day is the real day.
    const entered = s.stageEnteredAt ? s.stageEnteredAt.toISOString().slice(0, 10) : null;
    const history = earliestBySupplier.get(s.id) ?? null;

    let date: string;
    let source: Source;
    if (entered && !(history && history < entered)) {
      date = entered;
      source = 'stageEnteredAt';
    } else if (history) {
      date = history;
      source = 'history';
    } else {
      date = ONBOARDING_IMPORT_ANCHOR;
      source = 'anchor-estimate';
    }

    await prisma.supplier.update({ where: { id: s.id }, data: { onboardingDate: date } });
    fixed.push({
      folio: s.folio, name: s.name, stage: s.stage.name, old: s.onboardingDate, date, source,
      estimate: date === ONBOARDING_IMPORT_ANCHOR,
    });
  }

  const bySource = new Map<Source, number>(SOURCES.map(k => [k, 0]));
  for (const f of fixed) bySource.set(f.source, bySource.get(f.source)! + 1);
  const onAnchorDay = fixed.filter(f => f.estimate && f.source !== 'anchor-estimate').length;

  const remaining = (await prisma.supplier.findMany({ select: { onboardingDate: true } }))
    .filter(s => !s.onboardingDate.trim()).length;

  console.log(`[backfill:onboarding] corregidos: ${fixed.length}`);
  for (const k of SOURCES) console.log(`[backfill:onboarding]   ${k}: ${bySource.get(k)}`);
  console.log(`[backfill:onboarding]   (de stageEnteredAt/history, ${onAnchorDay} caen en ${ONBOARDING_IMPORT_ANCHOR} — probable estimación de la importación)`);
  console.log(`[backfill:onboarding] siguen vacíos tras esta corrida: ${remaining}`);
  if (bySource.get('anchor-estimate')! > 0 || remaining > 0) {
    const banner = '!'.repeat(78);
    console.warn(banner);
    console.warn('! [backfill:onboarding] Se esperaba que todo proveedor tuviera al menos una entrada de historial.');
    console.warn(`! [backfill:onboarding] Sin historial (ancla fija): ${bySource.get('anchor-estimate')}  ·  siguen vacíos: ${remaining}`);
    console.warn('! [backfill:onboarding] Revisa el log antes de confiar en los números de Visuals.');
    console.warn(banner);
  }

  const log: string[] = [];
  log.push('# Log backfill — Supplier.OnboardingDate');
  log.push('');
  log.push(`Generado: ${new Date().toISOString()}`);
  log.push('');
  log.push('Fecha con la que Visuals (filtros de periodo) cuenta a cada proveedor. Solo se escriben');
  log.push('filas cuyo `OnboardingDate` está vacío — re-ejecutar no cambia nada.');
  log.push('');
  log.push('## Resumen');
  log.push('');
  log.push(`- Candidatos (\`OnboardingDate\` vacío): **${pending.length}**`);
  log.push(`- Corregidos: **${fixed.length}**`);
  log.push(`- Siguen vacíos tras esta corrida: **${remaining}**`);
  log.push('');
  log.push('| Origen | Corregidos |');
  log.push('|---|--:|');
  for (const k of SOURCES) log.push(`| ${k} | ${bySource.get(k)} |`);
  log.push('');
  log.push(`> \`anchor-estimate\` usa el ancla fija \`${ONBOARDING_IMPORT_ANCHOR}\` (fecha real de la importación`);
  log.push('> del Excel), nunca la fecha de hoy. Además, **' + onAnchorDay + '** filas de `stageEnteredAt`/`history`');
  log.push(`> caen justo en \`${ONBOARDING_IMPORT_ANCHOR}\`: es el TODAY con el que import-rest.ts fechó a los`);
  log.push('> proveedores de Scouting sin fecha de evento, así que también son estimaciones (marcadas ⚠).');
  log.push('');
  log.push('## Detalle');
  log.push('');
  log.push('| Folio | Proveedor | Etapa | Valor anterior | OnboardingDate | Origen |');
  log.push('|---|---|---|---|---|---|');
  for (const f of fixed) {
    log.push(`| ${f.folio} | ${f.name} | ${f.stage} | \`${JSON.stringify(f.old)}\` | ${f.date} | ${f.source}${f.estimate ? ' ⚠ estimación' : ''} |`);
  }
  writeLog(log);

  console.log(`\n[backfill:onboarding] done ✔  log → ${path.join(OUT, LOG_FILE)}`);
}

main()
  .catch(err => {
    console.error('[backfill:onboarding] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
