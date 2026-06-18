import { mrlRequirements } from '../data/pipeline-demo';
import type { MRLRequirement } from '../types';

export function getMRLRequirements(): Promise<MRLRequirement[]> {
  return Promise.resolve(mrlRequirements);
}
