// Translate the frontend's free-text vocabulary into catalog FK keys.
import { type ImmexAnswer, type ImmexStatus } from '../domain/constants';

/** Normalizes confidence to ConfidenceLevel.code; unknown falls back to 'TBD'. */
export function normalizeConfidence(v: string): string {
  const s = v.trim().toUpperCase();
  if (s === 'H' || s === 'HIGH') return 'H';
  if (s === 'M' || s === 'MEDIUM') return 'M';
  if (s === 'L' || s === 'LOW') return 'L';
  return 'TBD';
}

/**
 * Form A Q34's single answer → the `C_ImmexStatus.name` that stores it.
 *
 * Total over `IMMEX_ANSWERS` by construction, and the reason the wire carries one
 * value instead of the `hasIMMEX`/`planIMMEX` pair it used to: a pair admits four
 * combinations for a question with three answers, so one flag had to silently win
 * over the other ("has IMMEX *and* plans to get one" resolved to 'In Plan'). With
 * one value per answer there is no combination left to arbitrate.
 *
 * 'TBC' is not produced here — no answer means it; see IMMEX_ANSWERS.
 */
const IMMEX_STATUS_BY_ANSWER: Readonly<Record<ImmexAnswer, ImmexStatus>> = {
  'Yes': 'Yes',
  'No, with a plan': 'In Plan',
  'No, without a plan': 'No',
};

/** The `ImmexStatus.name` behind one Q34 answer. */
export function immexNameFromAnswer(answer: ImmexAnswer): ImmexStatus {
  return IMMEX_STATUS_BY_ANSWER[answer];
}
