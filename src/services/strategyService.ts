import type { StrategyEntry, CommodityStrategyRow, CommodityStageSnapshot } from '../types';
import { strategyEntries } from '../data/strategy-demo';
import { pipelineSuppliers } from '../data/pipeline-demo';

export function getStrategyRows(): CommodityStrategyRow[] {
  return strategyEntries.map(entry => {
    const suppliersInCommodity = pipelineSuppliers.filter(
      s => s.commodity === entry.commodity
    );

    const stageGroups: Record<string, number[]> = {};
    suppliersInCommodity.forEach(s => {
      if (!stageGroups[s.stage]) stageGroups[s.stage] = [];
      stageGroups[s.stage].push(s.daysInStage);
    });

    const stages: CommodityStageSnapshot[] = Object.entries(stageGroups).map(
      ([stageName, days]) => ({
        stageName,
        count: days.length,
        avgDaysInStage: Math.round(days.reduce((a, b) => a + b, 0) / days.length),
      })
    );

    const total = suppliersInCommodity.length;
    return {
      commodity: entry.commodity,
      strategyNeeds2026: entry.strategyNeeds['2026'],
      totalInPipeline: total,
      remaining: Math.max(0, entry.strategyNeeds['2026'] - total),
      stages,
    };
  });
}

export function getStrategyEntries(): StrategyEntry[] {
  return strategyEntries;
}

export function getSuppliersForCommodity(commodity: string) {
  return pipelineSuppliers.filter(s => s.commodity === commodity);
}
