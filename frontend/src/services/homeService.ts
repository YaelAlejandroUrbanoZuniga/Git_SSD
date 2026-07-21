import { apiGet } from './api.config';

/** Aggregated, anonymous home summary — safe for the Default role. */
export interface HomeSummary {
  stageCounts: { stage: string; color: string; count: number }[];
  topCommodities: { commodity: string; count: number }[];
  totalActive: number;
  totalCompleted: number;
  totalBlacklisted: number;
  upcomingEvents: { id: string; name: string; dateStart: string; location: string }[];
}

export function getHomeSummary(): Promise<HomeSummary> {
  return apiGet('/home/summary');
}
