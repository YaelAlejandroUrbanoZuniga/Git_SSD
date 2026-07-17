import { apiGet, apiPatch } from './api.config';
import type {
  CommodityStrategyRow, TrackerSupplier, StrategyEntry,
} from '../types';

// NOTE: `getStrategyEntries` used to return `StrategyEntry[]` synchronously.
// It is now a real request and therefore async — callers must await it.
export function getStrategyEntries(): Promise<StrategyEntry[]> {
  return apiGet('/strategy/entries');
}

export function updateStrategyEntry(
  id: string,
  patch: Partial<StrategyEntry>,
): Promise<StrategyEntry> {
  return apiPatch(`/strategy/entries/${id}`, patch);
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
