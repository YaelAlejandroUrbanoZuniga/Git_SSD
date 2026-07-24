// Pure normalization/cleaning functions for the Excel import. No I/O, no side
// effects — every function here is unit-tested (tests/unit/dataImportNormalize.test.ts),
// because a silent error in any of them corrupts data at scale.

import { normalizeConfidence } from '../src/services/catalogMapping';
import {
  AGGREGATED_TO_PENDING, BUYER_ALIASES, CANONICAL_EVENTS, CATALOG_COMMODITIES,
  COMMODITY_ALIASES, EVENT_NAME_ALIASES, IMMEX_MAP, PENDING_GSM,
  RECOMMENDATION_INPUTS, SEEDED_USERS, SOCIETAL_PREFIXES, SOCIETAL_SUFFIXES,
} from './mappings';

export { normalizeConfidence };

/** Collapse internal/edge whitespace (incl. newlines) to single spaces. */
export function normalizeSpace(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

/** Strip diacritics (é→e, ñ→n). Expects an already-lowercased string. */
export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Normalized form of a company name, used ONLY for deduplication comparison — the
 * original name is always stored separately. Lowercase, accent-free, punctuation
 * removed, whitespace collapsed, and societal suffixes/prefixes (S.A. de C.V., Inc,
 * Grupo, …) stripped so "OGAWA" == "Ogawa" and "BOSCH S.A. de C.V." == "Bosch".
 */
export function normalizeName(raw: unknown): string {
  let s = stripAccents(String(raw ?? '').toLowerCase());
  s = s.replace(/\./g, '');            // s.a. → sa   (dot-join before other punct)
  s = s.replace(/[^a-z0-9 ]+/g, ' ');  // any other punctuation → space
  s = s.replace(/\s+/g, ' ').trim();
  // Strip leading company markers (Grupo X → x).
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of SOCIETAL_PREFIXES) {
      if (s === p) { s = ''; changed = true; }
      else if (s.startsWith(p + ' ')) { s = s.slice(p.length + 1); changed = true; }
    }
  }
  // Strip trailing societal suffixes, repeatedly (X S.A. de C.V. → x).
  changed = true;
  while (changed) {
    changed = false;
    for (const suf of SOCIETAL_SUFFIXES) {
      if (s === suf) { s = ''; changed = true; }
      else if (s.endsWith(' ' + suf)) { s = s.slice(0, -(suf.length + 1)).trim(); changed = true; }
    }
  }
  return s.replace(/\s+/g, ' ').trim();
}

export type CommodityReason = 'catalog' | 'alias' | 'aggregated' | 'empty' | 'unmapped';

/**
 * Map a raw commodity string to a catalog value. Returns the resolved commodity plus a
 * reason so the report can explain every value that fell to the placeholder. Never
 * throws, never invents a catalog value.
 */
export function mapCommodity(raw: unknown): { commodity: string; reason: CommodityReason } {
  const s = normalizeSpace(raw);
  if (!s) return { commodity: PENDING_GSM, reason: 'empty' };
  const lower = s.toLowerCase();
  if (AGGREGATED_TO_PENDING.some(a => a.toLowerCase() === lower)) {
    return { commodity: PENDING_GSM, reason: 'aggregated' };
  }
  if (COMMODITY_ALIASES[lower]) return { commodity: COMMODITY_ALIASES[lower], reason: 'alias' };
  const hit = CATALOG_COMMODITIES.find(c => c.toLowerCase() === lower);
  if (hit) return { commodity: hit, reason: 'catalog' };
  return { commodity: PENDING_GSM, reason: 'unmapped' };
}

/**
 * Cut a string to maxLen, appending a single-char ellipsis '…' when it overflows so the
 * result is never longer than maxLen. Returns the input unchanged when it fits.
 */
export function truncate(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  if (maxLen <= 1) return value.slice(0, maxLen);
  return value.slice(0, maxLen - 1) + '…';
}

/**
 * First integer anywhere in a prose string (thousands separators tolerated), else null.
 * "3 production plants, 2 sales offices" → 3; "598 globally" → 598; "NA" → null.
 */
export function extractInt(value: unknown): number | null {
  const s = String(value ?? '');
  const m = s.match(/-?\d[\d,]*/);
  if (!m) return null;
  const n = Number(m[0].replace(/,/g, ''));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * First 4-digit year (1900–2099) in a prose string, else null.
 * "Headquarter 1911 / New Boston plant 2022" → 1911; "NA" → null.
 */
export function extractYear(value: unknown): number | null {
  const m = String(value ?? '').match(/\b(19|20)\d{2}\b/);
  return m ? Number(m[0]) : null;
}

const DATE_JUNK = new Set(['tbd', 'tbc', '-', '#value!', 'na', 'n/a', 'n/d', '']);

/**
 * Excel cell → 'YYYY-MM-DD' or null. Handles JS Dates (from cellDates:true, read in
 * UTC), already-ISO strings and US m/d/yyyy; the junk literals (TBD/TBC/-/#VALUE!/…)
 * and time-only epoch dates (1899-12-30) become null. Never throws.
 */
export function parseExcelDate(value: unknown): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime()) || value.getUTCFullYear() < 1900) return null;
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = normalizeSpace(value);
  if (DATE_JUNK.has(s.toLowerCase())) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  return null;
}

/** IMMEX free text → catalog (Yes | No | In Plan | TBC). Empty/unknown → 'TBC'. */
export function normalizeImmex(raw: unknown): string {
  const s = normalizeSpace(raw).toLowerCase();
  return IMMEX_MAP[s] ?? 'TBC';
}

/**
 * "Is there a plant to get IMMEX?" free text → 'Y' | 'N' | null. The Excel carries full
 * sentences ("No, We do not have a facility…", "Yes, We plan to…"); the column is
 * NVARCHAR(5) so we normalize (never truncate). NA/TBD/empty → null.
 */
export function normalizePlanToGetImmex(raw: unknown): 'Y' | 'N' | null {
  const s = normalizeSpace(raw).toLowerCase();
  if (!s) return null;
  if (/^(yes|si|sí|y)\b/.test(s)) return 'Y';
  if (/^(no|n)\b/.test(s)) return 'N';
  if (/^(na|n\/a|tbd|tbc|-)$/.test(s)) return null;
  return null;
}

/** Y/N-style signed/received flags → 'Y' | 'N' | null. */
export function normalizeYN(raw: unknown): 'Y' | 'N' | null {
  const s = normalizeSpace(raw).toLowerCase();
  if (s === 'y' || s === 'yes' || s === 'si' || s === 'sí') return 'Y';
  if (s === 'n' || s === 'no') return 'N';
  return null;
}

const SUB_STATUSES = ['Go', 'No Go', 'Under Evaluation', 'On Hold'];

/** Parking Go/No-Go status → canonical sub-status, case-insensitive. Unknown → null. */
export function normalizeSubStatus(raw: unknown): string | null {
  const s = normalizeSpace(raw).toLowerCase();
  if (!s) return null;
  return SUB_STATUSES.find(v => v.toLowerCase() === s) ?? null;
}

/** Apply buyer aliases → official name; otherwise the space-normalized original. */
export function normalizeBuyer(raw: unknown): string {
  const s = normalizeSpace(raw);
  if (!s) return '';
  return BUYER_ALIASES[s.toLowerCase()] ?? s;
}

/** True if a (already normalized) buyer name is one of the 21 seeded users. */
export function isSeededUser(name: string): boolean {
  return SEEDED_USERS.some(u => u.toLowerCase() === name.toLowerCase());
}

/** Event name → canonical (Scouting Events Agenda) name. */
export function normalizeEventName(raw: unknown): string {
  const s = normalizeSpace(raw);
  if (!s) return '';
  return EVENT_NAME_ALIASES[s.toLowerCase()] ?? s;
}

/** True if a (raw) scouting-input string names one of the 7 canonical events. */
export function isEventName(raw: unknown): boolean {
  const canon = normalizeEventName(raw);
  return CANONICAL_EVENTS.some(e => e.toLowerCase() === canon.toLowerCase());
}

/**
 * entrySource from a Scouting-Input value: an event name → 'Scouting Event'; the known
 * recommendation phrases, anything containing "recommendation"/"recomendacion", empty,
 * or any other non-event text → 'Recommendation'.
 */
export function resolveEntrySource(scoutingInput: unknown): 'Scouting Event' | 'Recommendation' {
  const s = normalizeSpace(scoutingInput);
  if (isEventName(s)) return 'Scouting Event';
  return 'Recommendation';
}

export interface StageEvidence {
  inScouting?: boolean;
  inParking?: boolean;
  inPreliminary?: boolean;
  reachedSupplierEval?: boolean;
  reachedIntelex?: boolean;
  inBlacklist?: boolean;
}

export interface StageResolution {
  /** DTO `stage` field: the most advanced stage reached (blacklisted rows surface this,
   *  mirroring toSupplierDTO). One of the 5 active TrackerStage values. */
  stage: string;
  status: 'ACTIVE' | 'BLACKLISTED';
  /** DB column: the stage before exit, set only for blacklisted rows (else null). */
  stageBeforeExit: string | null;
}

/**
 * Resolve a merged supplier's stage from the sheets it appears in. Blacklist always
 * wins (status BLACKLISTED); otherwise the most advanced of Scouting < Parking <
 * Preliminary < Supplier Evaluation < Intelex Handoff. A blacklist-only row with no
 * other evidence floors at Scouting Event. Never returns 'Completed'.
 */
export function resolveStage(ev: StageEvidence): StageResolution {
  let reached: string | null = null;
  if (ev.inScouting) reached = 'Scouting Event';
  if (ev.inParking) reached = 'Parking Lot';
  if (ev.inPreliminary) reached = 'Preliminary Evaluation';
  if (ev.reachedSupplierEval) reached = 'Supplier Evaluation';
  if (ev.reachedIntelex) reached = 'Intelex Handoff';

  if (ev.inBlacklist) {
    const before = reached ?? 'Scouting Event';
    return { stage: before, status: 'BLACKLISTED', stageBeforeExit: before };
  }
  return { stage: reached ?? 'Scouting Event', status: 'ACTIVE', stageBeforeExit: null };
}
