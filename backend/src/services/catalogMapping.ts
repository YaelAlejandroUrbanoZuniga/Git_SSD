// Helpers that translate the frontend's free-text vocabulary into the catalog
// keys stored in the FK-backed tables (C_ConfidenceLevel, C_ImmexStatus, …).
// Shared by prisma/seed.ts and the supplier service so both encode identically.

/**
 * Maps confidence values to the 3-char ConfidenceLevel.code. The demo data is
 * inconsistent — some rows use labels ('High'/'Medium'/'Low') and some use the
 * short codes ('H'/'M'/'L'/'TBD'). Anything unrecognized falls back to 'TBD'.
 */
export function normalizeConfidence(v: string): string {
  const s = v.trim().toUpperCase();
  if (s === 'H' || s === 'HIGH') return 'H';
  if (s === 'M' || s === 'MEDIUM') return 'M';
  if (s === 'L' || s === 'LOW') return 'L';
  return 'TBD';
}

/**
 * Collapses the old independent hasIMMEX/planIMMEX booleans into a single
 * ImmexStatus.name. planIMMEX wins ('In Plan' is more specific than a bare
 * Yes/No); otherwise Yes when it has IMMEX, else No.
 */
export function immexNameFromFlags(hasIMMEX: boolean, planIMMEX: boolean): string {
  return planIMMEX ? 'In Plan' : hasIMMEX ? 'Yes' : 'No';
}
