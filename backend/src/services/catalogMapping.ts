// Translate the frontend's free-text vocabulary into catalog FK keys.

/** Normalizes confidence to ConfidenceLevel.code; unknown falls back to 'TBD'. */
export function normalizeConfidence(v: string): string {
  const s = v.trim().toUpperCase();
  if (s === 'H' || s === 'HIGH') return 'H';
  if (s === 'M' || s === 'MEDIUM') return 'M';
  if (s === 'L' || s === 'LOW') return 'L';
  return 'TBD';
}

/** Collapses hasIMMEX/planIMMEX into one ImmexStatus.name ('In Plan' wins). */
export function immexNameFromFlags(hasIMMEX: boolean, planIMMEX: boolean): string {
  return planIMMEX ? 'In Plan' : hasIMMEX ? 'Yes' : 'No';
}
