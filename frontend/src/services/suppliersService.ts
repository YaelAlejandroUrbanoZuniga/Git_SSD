import { pipelineSuppliers, blacklistedSuppliers } from '../data/pipeline-demo';
import type { PipelineSupplier, BlacklistedSupplier } from '../types';

export function getSuppliers(): Promise<(PipelineSupplier | BlacklistedSupplier)[]> {
  return Promise.resolve([...pipelineSuppliers, ...blacklistedSuppliers]);
}

export function getPipelineSuppliers(): Promise<PipelineSupplier[]> {
  return Promise.resolve(pipelineSuppliers);
}

export function getBlacklistedSuppliers(): Promise<BlacklistedSupplier[]> {
  return Promise.resolve(blacklistedSuppliers);
}

export function getSupplierById(
  id: string,
): Promise<PipelineSupplier | BlacklistedSupplier | undefined> {
  const match = [...pipelineSuppliers, ...blacklistedSuppliers].find(s => s.id === id);
  return Promise.resolve(match);
}
