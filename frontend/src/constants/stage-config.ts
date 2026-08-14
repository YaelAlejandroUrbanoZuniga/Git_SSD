import type { TrackerStage } from '../types';

export interface StageConfigEntry {
  name: TrackerStage | 'Blacklisted';
  color: string;
  icon: string;
}

/**
 * Stage colours and icons — presentation metadata, not data.
 *
 * This is deliberately a synchronous constant rather than something fetched:
 * `getStageColor()` is called inline all over the render tree, and making a
 * colour await a round-trip would turn every badge into a loading state.
 *
 * `GET /api/tracker/stage-config` serves the same colours for the 5 *working*
 * stages (the board columns) — `trackerService.getTrackerStageConfig()` reads it
 * for callers that want the server's version. It does not describe Blacklisted
 * or Completed, because those are exits from the board rather than columns on
 * it; both are defined here.
 *
 * Note: Scouting Event is '#02B3E1' here to agree with the backend. The old
 * `pipelineStageConfig` in the demo fixtures (`backend/prisma/fixtures/pipeline-demo.ts`)
 * had it as '#DC0202' (red) — the two disagreed while nothing read the API.
 * Kept the API's value so one colour is authoritative.
 */
export const TRACKER_STAGE_CONFIG: StageConfigEntry[] = [
  { name: 'Scouting Event', color: '#02B3E1', icon: 'fa-binoculars' },
  { name: 'Parking Lot', color: '#D4A017', icon: 'fa-circle-pause' },
  { name: 'Preliminary Evaluation', color: '#E3650B', icon: 'fa-clipboard-check' },
  { name: 'Supplier Evaluation', color: '#C026D3', icon: 'fa-file-contract' },
  { name: 'Intelex Handoff', color: '#0084C0', icon: 'fa-handshake' },
  { name: 'Completed', color: '#6ABF4B', icon: 'fa-circle-check' },
  { name: 'Blacklisted', color: '#000000', icon: 'fa-ban' },
];

/** The two states the backend's stage-config endpoint does not describe. */
export const TERMINAL_STAGE_CONFIG: StageConfigEntry[] = TRACKER_STAGE_CONFIG.slice(5);
