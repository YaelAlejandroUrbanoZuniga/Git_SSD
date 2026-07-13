import type { PipelineSupplier } from '../types';
import { pipelineStageConfig } from '../data/pipeline-demo';

export function getStageColor(name: string): string {
  return pipelineStageConfig.find(s => s.name === name)?.color ?? '#808285';
}

export function getDocsBarColor(percent: number): string {
  if (percent >= 75) return '#6ABF4B';
  if (percent >= 50) return '#D4A017';
  return '#DC0202';
}

export function getInfoCompletionPercent(supplier: PipelineSupplier): number {
  const stage = supplier.stage;

  if (stage === 'Scouting Event') {
    const t = supplier.scoutingTabsCompleted;
    if (!t) return 0;
    const total = 5;
    const done = [t.scoutingEvent, t.supplierInfo, t.attendees, t.agenda, t.nextStep].filter(Boolean).length;
    return Math.round((done / total) * 100);
  }

  if (stage === 'Parking Lot') {
    const t = supplier.parkingTabsCompleted;
    if (!t) return 0;
    const total = 3;
    const done = [t.overview, t.contact, t.details].filter(Boolean).length;
    return Math.round((done / total) * 100);
  }

  if (stage === 'Preliminary Evaluation') {
    const t = supplier.preliminaryTabsCompleted;
    if (!t) return 0;
    const total = 3;
    const done = [t.overview, t.capabilities, t.visit].filter(Boolean).length;
    return Math.round((done / total) * 100);
  }

  if (stage === 'Supplier Evaluation') {
    const t = supplier.supplierEvalTabsCompleted;
    if (!t) return 0;
    const total = 2;
    const done = [t.competitiveness, t.fundamentals].filter(Boolean).length;
    return Math.round((done / total) * 100);
  }

  if (stage === 'Intelex Handoff') return 100;

  return 0;
}
