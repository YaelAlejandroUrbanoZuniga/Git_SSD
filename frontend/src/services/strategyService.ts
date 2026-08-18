import { apiGet, apiPatch } from './api.config';
import type {
  CommodityStrategyRow, TrackerSupplier, StrategyEntry,
} from '../types';

export function getStrategyEntries(): Promise<StrategyEntry[]> {
  return apiGet('/strategy/entries');
}

export function updateStrategyEntry(
  id: string,
  patch: Partial<StrategyEntry>,
): Promise<StrategyEntry> {
  return apiPatch(`/strategy/entries/${id}`, patch);
}

/**
 * Upsert strategy needs by commodity name. Works whether or not the commodity
 * already has an entry — the backend creates one on first save.
 */
export function upsertStrategyNeeds(
  commodity: string,
  needs: Partial<StrategyEntry['strategyNeeds']>,
): Promise<StrategyEntry> {
  return apiPatch(`/strategy/entries/by-commodity/${encodeURIComponent(commodity)}`, { strategyNeeds: needs });
}

/** Per-commodity roll-up — the backend runs the same algorithm StrategyPage used to. */
export function getStrategyOverview(): Promise<CommodityStrategyRow[]> {
  return apiGet('/strategy/overview');
}

export function getCommodityDrilldown(
  commodity: string,
): Promise<{ row: CommodityStrategyRow; suppliers: TrackerSupplier[] }> {
  return apiGet(`/strategy/commodity/${encodeURIComponent(commodity)}`);
}
