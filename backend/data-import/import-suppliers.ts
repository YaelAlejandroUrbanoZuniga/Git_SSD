/**
 * DB importer for the deduplicated real GSM suppliers produced by parse.ts.
 *
 *   IMPORT_REAL_DATA=true npm run import:suppliers
 *
 * Reads data-import/output/suppliers.json and inserts each supplier by REUSING
 * `seedSupplier()` from prisma/seed.ts (the same writer the demo seed uses — no new
 * insert path). It NEVER deletes anything: it does not call seedDemoTrackerData() or
 * any deleteMany(). Safe to re-run — suppliers already present (by name + commodity)
 * are skipped, so a partial run can be finished without duplicating.
 *
 * Guarded by IMPORT_REAL_DATA=true (same pattern as SEED_DEMO). Without it, the script
 * prints a warning and exits without touching the database.
 *
 * Each imported supplier gets:
 *   - folio  XL-SSD-<year>-NNNN  (the XL- prefix marks Excel-migrated rows and keeps
 *            them out of the native SSD-<year>-NNNN sequence — nextFolio() excludes XL-).
 *   - id     xl-<uuid>
 *   - a first history entry whose `action` records the source Excel folios, e.g.
 *     "Imported from Excel — origen: Parking Lot List folio 100; Blacklist folio 34".
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { seedSupplier, type CatalogIds } from '../prisma/seed';
import { supplierInclude, toSupplierDTO } from '../src/mappers/supplierMapper';
import { syncSuppliersSla } from '../src/services/slaService';
import { todayISO } from '../src/domain/constants';
import { escapeMarkdownCell } from './mappings';
import { assertTestDatabase } from '../src/config/testDatabaseGuard';

const OUT = path.join(__dirname, 'output');
const YEAR = new Date().getFullYear();
const XL_PREFIX = `XL-SSD-${YEAR}-`;
const BATCH_SIZE = 50;
const PENDING_GSM = 'TBD -- Pending GSM';

const prisma = new PrismaClient();

/** Loose type for the parsed JSON — full TrackerSupplier shape plus importer extras. */
type RawSupplier = Record<string, unknown> & {
  id: string | null;
  folio: string | null;
  name: string;
  commodity: string;
  onboardingDate: string;
  history: unknown[];
  _excelSources?: string[];
};
type SeedSupplierArg = Parameters<typeof seedSupplier>[1];

interface FailInfo { name: string; commodity: string; error: string; }

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Catalog name → id maps, exactly as seedDemoTrackerData() builds them. */
async function buildCatalogIds(): Promise<CatalogIds> {
  const commodityIds = new Map((await prisma.commodity.findMany()).map(c => [c.name, c.id]));
  return {
    commodity: commodityIds,
    stage: new Map((await prisma.stage.findMany()).map(s => [s.name, s.id])),
    status: new Map((await prisma.supplierStatus.findMany()).map(s => [s.name, s.id])),
    subStatus: new Map((await prisma.subStatus.findMany()).map(s => [s.name, s.id])),
    sla: new Map((await prisma.sla.findMany()).map(s => [s.name, s.id])),
    productCategory: new Map((await prisma.productCategory.findMany()).map(s => [s.name, s.id])),
    confidence: new Map((await prisma.confidenceLevel.findMany()).map(c => [c.code, c.id])),
    immex: new Map((await prisma.immexStatus.findMany()).map(s => [s.name, s.id])),
    role: new Map((await prisma.role.findMany()).map(r => [r.name, r.id])),
  };
}

/** Existing suppliers as a set of `name||commodity` keys (idempotency). */
async function loadExistingKeys(): Promise<Set<string>> {
  const rows = await prisma.supplier.findMany({
    select: { name: true, commodity: { select: { name: true } } },
  });
  return new Set(rows.map(r => `${r.name}||${r.commodity.name}`));
}

/** Highest existing XL- folio number, so a re-run continues the sequence. */
async function maxXlNumber(): Promise<number> {
  const rows = await prisma.supplier.findMany({
    where: { folio: { startsWith: XL_PREFIX } },
    select: { folio: true },
  });
  return rows.reduce((max, r) => {
    const n = Number(r.folio.slice(XL_PREFIX.length));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
}

async function importSuppliers() {
  const file = path.join(OUT, 'suppliers.json');
  if (!fs.existsSync(file)) {
    throw new Error(`Not found: ${file}. Run "npm run import:parse" first.`);
  }
  const suppliers = JSON.parse(fs.readFileSync(file, 'utf8')) as RawSupplier[];
  console.log(`[import] loaded ${suppliers.length} suppliers from suppliers.json`);

  const ids = await buildCatalogIds();
  const existing = await loadExistingKeys();

  // Partition into skip (already present) vs import.
  const skipped: RawSupplier[] = [];
  const toImport: RawSupplier[] = [];
  for (const s of suppliers) {
    if (existing.has(`${s.name}||${s.commodity}`)) skipped.push(s);
    else toImport.push(s);
  }
  console.log(`[import] ${skipped.length} already present (skipped), ${toImport.length} to insert`);

  // Assign folio, id and the traceability history entry to the new ones.
  let n = await maxXlNumber();
  for (const s of toImport) {
    n += 1;
    s.folio = `${XL_PREFIX}${String(n).padStart(4, '0')}`;
    s.id = `xl-${randomUUID()}`;
    const origin = (s._excelSources ?? []).join('; ') || 'unknown source';
    let action = `Imported from Excel — origen: ${origin}`;
    if (action.length > 500) action = action.slice(0, 499) + '…'; // History.Action is NVARCHAR(500)
    s.history = [{
      date: s.onboardingDate || todayISO(),
      action,
      user: 'Excel import',
      role: 'SSD',
    }];
  }

  // Insert in batches of 50 per transaction so one bad row can't sink the whole run;
  // if a batch transaction fails, retry its rows individually to isolate the culprit.
  const inserted: RawSupplier[] = [];
  const failed: FailInfo[] = [];
  for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
    const batch = toImport.slice(i, i + BATCH_SIZE);
    try {
      await prisma.$transaction(
        async tx => {
          for (const s of batch) {
            await seedSupplier(tx as unknown as PrismaClient, s as unknown as SeedSupplierArg, ids);
          }
        },
        { timeout: 120000 },
      );
      inserted.push(...batch);
      console.log(`[import] batch ${i / BATCH_SIZE + 1}: +${batch.length} (total ${inserted.length})`);
    } catch (batchErr) {
      console.warn(`[import] batch ${i / BATCH_SIZE + 1} failed, isolating rows: ${errMsg(batchErr)}`);
      for (const s of batch) {
        try {
          await seedSupplier(prisma, s as unknown as SeedSupplierArg, ids);
          inserted.push(s);
        } catch (e) {
          failed.push({ name: s.name, commodity: s.commodity, error: errMsg(e) });
          console.error(`[import]   ✗ ${s.name} [${s.commodity}]: ${errMsg(e)}`);
        }
      }
    }
  }

  return { total: suppliers.length, skipped, inserted, failed };
}

// ── Post-import verification ────────────────────────────────────────────────
async function verify() {
  const rows = await prisma.supplier.findMany({
    where: { folio: { startsWith: XL_PREFIX } },
    include: supplierInclude,
  });
  // Recompute + persist SLA the same way every read path does (active rows only),
  // so the counts reflect the real elapsed-day colours instead of the seed default.
  const synced = await syncSuppliersSla(prisma, rows);
  const dtos = synced.map(toSupplierDTO);

  const byStatus = new Map<string, number>();
  const byStage = new Map<string, number>();
  let tbd = 0;
  let redSla = 0;
  for (const r of synced) {
    const status = r.status.name;
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    // Blacklisted rows keep their frozen stage; label them 'Blacklisted' for clarity.
    const label = status === 'BLACKLISTED' ? 'Blacklisted' : r.stage.name;
    byStage.set(label, (byStage.get(label) ?? 0) + 1);
    if (r.commodity.name === PENDING_GSM) tbd += 1;
    if (status === 'ACTIVE' && r.sla.name === 'red') redSla += 1;
  }
  return { count: dtos.length, byStatus, byStage, tbd, redSla };
}

function writeLog(
  res: { total: number; skipped: RawSupplier[]; inserted: RawSupplier[]; failed: FailInfo[] },
  ver: Awaited<ReturnType<typeof verify>>,
  ran: boolean,
) {
  const L: string[] = [];
  L.push('# Log de importación — Excel → base de datos');
  L.push('');
  L.push(`Generado: ${new Date().toISOString()}`);
  L.push('');
  if (!ran) {
    L.push('> **No se ejecutó.** `IMPORT_REAL_DATA` no estaba en `true`, así que el script');
    L.push('> salió sin tocar la base de datos.');
    fs.writeFileSync(path.join(OUT, 'import-log.md'), L.join('\n'), 'utf8');
    return;
  }
  L.push('## Resumen');
  L.push('');
  L.push(`- Total en \`suppliers.json\`: **${res.total}**`);
  L.push(`- **Insertados: ${res.inserted.length}** (folios ${XL_PREFIX}0001 … en adelante)`);
  L.push(`- Saltados por duplicado (ya importados): **${res.skipped.length}**`);
  L.push(`- **Fallidos: ${res.failed.length}**`);
  L.push('');
  if (res.failed.length) {
    L.push('### Fallidos (con el error)');
    L.push('');
    L.push('| Proveedor | Commodity | Error |');
    L.push('|---|---|---|');
    for (const f of res.failed) L.push(`| ${esc(f.name)} | ${esc(f.commodity)} | ${esc(f.error)} |`);
    L.push('');
  }
  L.push('## Verificación posterior (solo proveedores XL- importados)');
  L.push('');
  L.push(`Total XL- en la base: **${ver.count}**`);
  L.push('');
  L.push('### Por status');
  L.push('');
  for (const [k, v] of ver.byStatus) L.push(`- ${k}: ${v}`);
  L.push('');
  L.push('### Por etapa (los blacklisted se listan aparte; conservan su etapa congelada en el esquema)');
  L.push('');
  L.push('| Etapa | Proveedores |');
  L.push('|---|---:|');
  for (const st of ['Scouting Event', 'Parking Lot', 'Preliminary Evaluation', 'Supplier Evaluation', 'Intelex Handoff', 'Blacklisted']) {
    L.push(`| ${st} | ${ver.byStage.get(st) ?? 0} |`);
  }
  L.push('');
  L.push(`### Commodity \`${PENDING_GSM}\`: **${ver.tbd}** proveedores`);
  L.push('');
  L.push(`### SLA en rojo (activos): **${ver.redSla}**`);
  L.push('');
  L.push('> El SLA rojo es **esperado y correcto**, no un bug: el color se deriva de los días');
  L.push('> reales transcurridos desde la fecha de onboarding (77–317 días en los datos reales)');
  L.push('> contra un umbral de 25/30 días en Parking Lot. El backend lo recalcula en cada lectura.');
  fs.writeFileSync(path.join(OUT, 'import-log.md'), L.join('\n'), 'utf8');
}

const esc = escapeMarkdownCell;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  if (process.env.IMPORT_REAL_DATA !== 'true') {
    console.warn(
      '\n[import] ⚠ IMPORT_REAL_DATA no está en "true" — no se importó nada.\n' +
      '[import]   Este script escribe proveedores REALES en la base de datos.\n' +
      '[import]   Para ejecutarlo: IMPORT_REAL_DATA=true npm run import:suppliers\n',
    );
    writeLog({ total: 0, skipped: [], inserted: [], failed: [] }, { count: 0, byStatus: new Map(), byStage: new Map(), tbd: 0, redSla: 0 }, false);
    return;
  }

  // IMPORT_REAL_DATA says "I want the import", not "I am pointed at the right
  // database" — DATABASE_URL comes from the same .env the server uses. Refuse
  // anything but a *_TEST base before the first write.
  assertTestDatabase('[import]');

  console.log('[import] IMPORT_REAL_DATA=true — importando proveedores reales…');
  const res = await importSuppliers();
  const ver = await verify();

  console.log('\n════════════ RESUMEN ════════════');
  console.log(`Insertados:            ${res.inserted.length}`);
  console.log(`Saltados (duplicado):  ${res.skipped.length}`);
  console.log(`Fallidos:              ${res.failed.length}`);
  console.log('\n──────── Verificación (XL- en la base) ────────');
  console.log(`Total XL-:             ${ver.count}`);
  console.log('Por status:', Object.fromEntries(ver.byStatus));
  console.log('Por etapa:', Object.fromEntries(ver.byStage));
  console.log(`Commodity '${PENDING_GSM}': ${ver.tbd}`);
  console.log(`SLA rojo (activos):    ${ver.redSla}  (esperado — días reales 77–317 vs umbral 25/30)`);
  console.log('═════════════════════════════════');

  writeLog(res, ver, true);
  console.log(`\n[import] done ✔  log → ${path.join(OUT, 'import-log.md')}`);
}

main()
  .catch(err => {
    console.error('[import] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
