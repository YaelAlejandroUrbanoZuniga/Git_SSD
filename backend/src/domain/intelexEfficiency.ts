// Intelex Handoff efficiency — the team's stepped delay penalty, in one place.
//
// Efficiency is measured PER LEVEL, from that level's own pair of dates: how
// late its "Real" date landed against its own "Expected" date. There is no
// common anchor — an early level slipping does not, by itself, drag the later
// ones down; each level answers only for its own delay.
//
// The scale comes from the GSM team's Excel (columns BY = Expected, CE = Real of
// the same level, delay = CE - BY in days) and is deliberately transcribed as
// five explicit branches, in the Excel's own order, so it stays trivial to audit
// against that file if the team retunes it:
//
//   delay <= 0   → 0.95      (no bonus for finishing early — the formula caps here)
//   delay <= 5   → 0.95      (grace period; same value as above, kept separate on
//                             purpose so the <= 0 boundary can be retuned alone)
//   delay <= 15  → 0.95 - (delay - 5) * 0.025
//   delay <= 25  → 0.70 - (delay - 15) * 0.02
//   delay > 25   → 0.50      (floor)
//
// The branches meet exactly at their boundaries (delay 15 → 0.70, delay 25 →
// 0.50), so the curve is continuous: a level one day later is always worth
// slightly less, never a step down to 0 or up to 1. That gradual behaviour is
// the whole point — the previous planned/actual ratio measured from the record
// creation date and in practice only ever produced 0% or 100%.
//
// Consumers: suppliersService.updateSupplier persists the six values (five
// levels + global) on IntelexData; the frontend reads them back through the
// mapper. The editable Timeline form mirrors this function for its live preview
// (see frontend/src/pages/tracker/read-only-tabs.tsx) — this module is the
// source of truth and the mirror says so.

/** The five levels that carry an efficiency, with the IntelexData columns each reads/writes. */
export const INTELEX_EFFICIENCY_LEVELS: {
  label: string;
  expectedKey: string;
  realKey: string;
  efficiencyKey: string;
}[] = [
  { label: 'L0', expectedKey: 'l0Expected', realKey: 'l0Real', efficiencyKey: 'efficiencyL0' },
  { label: 'L1', expectedKey: 'l1Expected', realKey: 'l1Real', efficiencyKey: 'efficiencyL1' },
  { label: 'L2', expectedKey: 'l2Expected', realKey: 'l2Real', efficiencyKey: 'efficiencyL2' },
  { label: 'L3', expectedKey: 'l3Expected', realKey: 'l3Real', efficiencyKey: 'efficiencyL3' },
  { label: 'L4', expectedKey: 'l4Expected', realKey: 'l4Real', efficiencyKey: 'efficiencyL4' },
];

/** The column holding the average of the five, so callers never spell it twice. */
export const INTELEX_EFFICIENCY_GLOBAL_KEY = 'efficiencyGlobal';

/**
 * A stored Intelex date as a UTC timestamp, or null when it is absent or not a
 * date. Same "what counts as a date" rule as domain/intelexLevels: the columns
 * are NVarChar and the UI writes plain 'YYYY-MM-DD', but an ISO instant would
 * also arrive day-first, so slicing to the day makes both comparable — and
 * building the timestamp from the day alone keeps the difference an exact whole
 * number of days regardless of any time part or of the server's timezone.
 */
function dayTimestamp(value: string | null | undefined): number | null {
  if (typeof value !== 'string') return null;
  const day = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const ms = Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Efficiency of ONE Intelex level, as a fraction 0.50–0.95, from its own
 * Expected/Real pair. `null` when either date is missing or unparseable — a
 * level that has not been captured yet has no efficiency, which is not the same
 * as a bad one, so a partially-filled Timeline still scores the levels it has.
 */
export function calcIntelexLevelEfficiency(
  expected: string | null | undefined,
  real: string | null | undefined,
): number | null {
  const expectedAt = dayTimestamp(expected);
  const realAt = dayTimestamp(real);
  if (expectedAt === null || realAt === null) return null;

  const delay = Math.round((realAt - expectedAt) / 86400000);
  if (delay <= 0) return 0.95;
  if (delay <= 5) return 0.95;
  if (delay <= 15) return 0.95 - (delay - 5) * 0.025;
  if (delay <= 25) return 0.70 - (delay - 15) * 0.02;
  return 0.50;
}

/**
 * The handoff's global efficiency: the plain average of the levels that HAVE
 * one. Uncaptured levels are skipped, never counted as 0 — otherwise a supplier
 * would start at 20% of its eventual score and climb as it advances, which
 * measures progress, not punctuality. `null` while no level has both dates.
 */
export function calcIntelexGlobalEfficiency(levelEfficiencies: (number | null)[]): number | null {
  const scored = levelEfficiencies.filter((e): e is number => e !== null);
  if (scored.length === 0) return null;
  return scored.reduce((sum, e) => sum + e, 0) / scored.length;
}
