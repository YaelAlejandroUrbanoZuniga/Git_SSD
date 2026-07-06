import { pipelineStageConfig } from '../data/pipeline-demo';
import type { PipelineStage } from '../types';

export function getPipelineStageConfig(): Promise<typeof pipelineStageConfig> {
  return Promise.resolve(pipelineStageConfig);
}

export function moveSupplierToStage(
  supplierId: string,
  newStage: PipelineStage,
): Promise<void> {
  console.log(`[pipelineService] moveSupplierToStage: ${supplierId} -> ${newStage}`);
  return Promise.resolve();
}

export function blacklistSupplier(supplierId: string, reason: string): Promise<void> {
  console.log(`[pipelineService] blacklistSupplier: ${supplierId} (${reason})`);
  return Promise.resolve();
}
