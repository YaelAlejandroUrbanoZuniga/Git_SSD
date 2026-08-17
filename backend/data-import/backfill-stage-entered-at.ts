/**
 * One-time catch-up: fill Supplier.StageEnteredAt for ACTIVE suppliers that still
 * have it null.
 *
 *   BACKFILL_STAGE_ENTERED_AT=true npm run import:backfill-stage
 *
 * WHY THIS EXISTS. `stageEnteredAt` is the anchor the live "Days in Stage" counter
 * reads (src/domain/sla.ts → resolveSla). Rows created through the app always have
 * it (createSupplier / moveSupplierToStage / blacklistSupplier stamp it), but rows
 * that arrived through the seed or the Excel import did not — their counter was
 * frozen at whatever number was written once. The seed (prisma/seed.ts) and the
 * import backfill (import-rest.ts, Part 4) now both set it, but the real import
 * ALREADY RAN on 2026-07-24 (commit c23fed5), and `backfillHistory()` skips any
 * supplier whose birth history row already carries a `toStageId` — so re-running
 * `import:rest` would report "already backfilled" for all of them and change
 * nothing. This script is that retroactive pass, for data that already exists.
 *
 * WHAT IT DOES. For each ACTIVE supplier with a null `stageEnteredAt` (any folio —
 * demo and XL- alike) it takes the **most recent T_Supplier_History entry whose
 * `toStageId` is the supplier's current stage** and uses that entry's `date`. That
 * row is the real, recorded moment the supplier entered where it is now.
 * Suppliers currently in **Supplier Evaluation** instead get the literal
 * 2026-07-24 anchor — same constant and same reasoning as import-rest.ts: the
 * Excel has no per-station date for that stage, its history entry carries an
 * ESTIMATE derived from the Pre-Evaluation start date, and anchoring on it would
 * show a fabricated, inflated day count from day one.
 *
 * SAFE TO RE-RUN. It only ever writes rows where the column is null, so a second
 * run is a no-op. It writes nothing else. TEST database only (MX_MFGIT_SSD_TEST) —
 * point DATABASE_URL at production and it would touch production, so don't.
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { toNoonUTCOrNull } from '../src/domain/constants';
import { assertTestDatabase } from '../src/config/testDatabaseGuard';

const OUT = path.join(__dirname, 'output');

/**
 * Same value and same justification as import-rest.ts's SUPPLIER_EVAL_IMPORT_ANCHOR:
 * the date the real Excel import ran. Kept as a literal rather than a dynamic TODAY
 * so a later re-run cannot silently reset these suppliers' clocks to zero.
 */
const SUPPLIER_EVAL_IMPORT_ANCHOR = '2026-07-24';
const SUPPLIER_EVAL = 'Supplier Evaluation';

/** Day-precision string → timestamp at noon UTC; null when it is not a date.
 *  The rule itself lives in domain/constants (shared with the seed and import:rest). */
const atNoonUTC = toNoonUTCOrNull;

function writeLog(lines: string[]) {
  fs.writeFileSync(path.join(OUT, 'backfill-stage-entered-at-log.md'), lines.join('\n'), 'utf8');
}

interface Fixed { folio: string; name: string; stage: string; date: string; source: string; }

const prisma = new PrismaClient();

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  if (process.env.BACKFILL_STAGE_ENTERED_AT !== 'true') {
    console.warn(
      '\n[backfill:stage] ⚠ BACKFILL_STAGE_ENTERED_AT no está en "true" — no se tocó nada.\n' +
      '[backfill:stage]   Para ejecutarlo: BACKFILL_STAGE_ENTERED_AT=true npm run import:backfill-stage\n',
    );
    writeLog(['# Log backfill stageEnteredAt', '', '> No se ejecutó (BACKFILL_STAGE_ENTERED_AT != true).']);
    return;
  }

  // The header above already said "TEST database only" — this enforces it, with
  // the same check the seed and the two importers use.
  assertTestDatabase('[backfill:stage]');

  const pending = await prisma.supplier.findMany({
    where: { stageEnteredAt: null, status: { is: { name: 'ACTIVE' } } },
    select: { id: true, folio: true, name: true, stageId: true, stage: { select: { name: true } } },
    orderBy: { folio: 'asc' },
  });
  console.log(`[backfill:stage] proveedores ACTIVE con stageEnteredAt null: ${pending.length}`);

  const fixed: Fixed[] = [];
  const skipped: { folio: string; name: string; stage: string; reason: string }[] = [];

  for (const s of pending) {
    let date: string;
    let source: string;

    if (s.stage.name === SUPPLIER_EVAL) {
      date = SUPPLIER_EVAL_IMPORT_ANCHOR;
      source = 'ancla fija de importación (el Excel no tiene fecha propia de esta etapa)';
    } else {
      // The recorded transition INTO the stage the supplier is in right now.
      // Same ordering as reportsService.getStageSnapshot: date, then createdAt,
      // then id — `date` is a 'YYYY-MM-DD' string, which sorts chronologically.
      const entry = await prisma.supplierHistoryEntry.findFirst({
        where: { supplierId: s.id, toStageId: s.stageId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        select: { date: true },
      });
      if (!entry) {
        skipped.push({ folio: s.folio, name: s.name, stage: s.stage.name, reason: 'sin entrada de historial hacia su etapa actual' });
        continue;
      }
      date = entry.date;
      source = 'T_Supplier_History (última transición hacia la etapa actual)';
    }

    const stamp = atNoonUTC(date);
    if (!stamp) {
      skipped.push({ folio: s.folio, name: s.name, stage: s.stage.name, reason: `fecha no parseable: "${date}"` });
      continue;
    }
    await prisma.supplier.update({ where: { id: s.id }, data: { stageEnteredAt: stamp } });
    fixed.push({ folio: s.folio, name: s.name, stage: s.stage.name, date, source });
  }

  const byStage = new Map<string, number>();
  for (const f of fixed) byStage.set(f.stage, (byStage.get(f.stage) ?? 0) + 1);

  console.log(`[backfill:stage] corregidos: ${fixed.length}  ·  omitidos: ${skipped.length}`);
  for (const [stage, n] of [...byStage].sort()) console.log(`[backfill:stage]   ${stage}: ${n}`);

  const remaining = await prisma.supplier.count({
    where: { stageEnteredAt: null, status: { is: { name: 'ACTIVE' } } },
  });

  const log: string[] = [];
  log.push('# Log backfill — Supplier.StageEnteredAt');
  log.push('');
  log.push(`Generado: ${new Date().toISOString()}`);
  log.push('');
  log.push('Ancla del contador "Days in Stage" en vivo (src/domain/sla.ts). Solo se escriben');
  log.push('filas ACTIVE cuyo `StageEnteredAt` está en null — re-ejecutar no cambia nada.');
  log.push('');
  log.push('## Resumen');
  log.push('');
  log.push(`- Candidatos (ACTIVE con \`StageEnteredAt\` null): **${pending.length}**`);
  log.push(`- Corregidos: **${fixed.length}**`);
  log.push(`- Omitidos: **${skipped.length}**`);
  log.push(`- Siguen en null tras esta corrida: **${remaining}**`);
  log.push('');
  log.push('| Etapa | Corregidos |');
  log.push('|---|--:|');
  for (const [stage, n] of [...byStage].sort()) log.push(`| ${stage} | ${n} |`);
  log.push('');
  log.push(`> \`${SUPPLIER_EVAL}\` usa el ancla fija \`${SUPPLIER_EVAL_IMPORT_ANCHOR}\` (fecha real de la`);
  log.push('> importación del Excel) porque su fecha en el historial es una ESTIMACIÓN derivada del');
  log.push('> Pre-Evaluation Start Date, y anclarse a ella mostraría un conteo inflado desde el día uno.');
  log.push('');
  if (skipped.length > 0) {
    log.push('## Omitidos');
    log.push('');
    log.push('| Folio | Proveedor | Etapa | Motivo |');
    log.push('|---|---|---|---|');
    for (const s of skipped) log.push(`| ${s.folio} | ${s.name} | ${s.stage} | ${s.reason} |`);
    log.push('');
  }
  log.push('## Detalle');
  log.push('');
  log.push('| Folio | Proveedor | Etapa | StageEnteredAt | Origen |');
  log.push('|---|---|---|---|---|');
  for (const f of fixed) log.push(`| ${f.folio} | ${f.name} | ${f.stage} | ${f.date} | ${f.source} |`);
  writeLog(log);

  console.log(`\n[backfill:stage] done ✔  log → ${path.join(OUT, 'backfill-stage-entered-at-log.md')}`);
}

main()
  .catch(err => {
    console.error('[backfill:stage] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
