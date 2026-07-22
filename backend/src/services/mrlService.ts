import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { COMMODITIES, type Commodity } from '../domain/constants';
import { NotFoundError, ValidationError } from '../domain/errors';

type MrlRow = Prisma.MrlRequirementGetPayload<{ include: { commodity: true } }>;

function toMrlDTO(m: MrlRow) {
  return {
    id: m.id,
    buyerName: m.buyerName,
    commodity: m.commodity.name,
    nexteerProductLine: m.nexteerProductLine,
    volumeByYear: {
      '2026': m.vol2026,
      '2027': m.vol2027,
      '2028': m.vol2028,
      '2029': m.vol2029,
      '2030': m.vol2030,
      '2031': m.vol2031,
    },
    partNumber: m.partNumber,
    partDescription: m.partDescription,
    mainMaterialsSpecTech: m.mainMaterialsSpecTech,
    peakVolume: m.peakVolume,
    program: m.program,
    eop: m.eop,
    targetPrice: m.targetPrice,
    priority: m.priority,
    primaryDriver: m.primaryDriver,
    keyManufacturingCapabilities: m.keyManufacturingCapabilities,
    safetyCriticalPart: m.safetyCriticalPart,
    supplierExperienceInSafetyRequired: m.supplierExperienceInSafetyRequired,
    certifications: m.certifications,
    knowsCQIs: m.knowsCQIs,
  };
}

export async function getMrlRequirements(prisma: PrismaClient) {
  const rows = await prisma.mrlRequirement.findMany({
    include: { commodity: true },
    orderBy: { id: 'asc' },
  });
  return rows.map(toMrlDTO);
}

interface MrlInput {
  buyerName?: string;
  commodity?: string;
  nexteerProductLine?: string;
  volumeByYear?: Partial<Record<'2026' | '2027' | '2028' | '2029' | '2030' | '2031', number | null>>;
  partNumber?: string;
  partDescription?: string;
  mainMaterialsSpecTech?: string;
  peakVolume?: number | null;
  program?: string;
  eop?: string;
  targetPrice?: number | null;
  priority?: 1 | 2 | 3;
  primaryDriver?: string;
  keyManufacturingCapabilities?: string;
  safetyCriticalPart?: boolean;
  supplierExperienceInSafetyRequired?: boolean;
  certifications?: string;
  knowsCQIs?: boolean;
}

async function commodityIdFor(prisma: PrismaClient, name: string): Promise<number> {
  if (!COMMODITIES.includes(name as Commodity)) {
    throw new ValidationError(`Unknown commodity: ${name}`);
  }
  const commodity = await prisma.commodity.findUnique({ where: { name } });
  if (!commodity) throw new ValidationError(`Commodity not in catalog: ${name}`);
  return commodity.id;
}

function volumeData(v: MrlInput['volumeByYear']) {
  if (!v) return {};
  return {
    ...(v['2026'] !== undefined ? { vol2026: v['2026'] } : {}),
    ...(v['2027'] !== undefined ? { vol2027: v['2027'] } : {}),
    ...(v['2028'] !== undefined ? { vol2028: v['2028'] } : {}),
    ...(v['2029'] !== undefined ? { vol2029: v['2029'] } : {}),
    ...(v['2030'] !== undefined ? { vol2030: v['2030'] } : {}),
    ...(v['2031'] !== undefined ? { vol2031: v['2031'] } : {}),
  };
}

export async function createMrlRequirement(prisma: PrismaClient, input: MrlInput) {
  if (!input.commodity) throw new ValidationError('commodity is required');
  if (!input.buyerName?.trim()) throw new ValidationError('buyerName is required');
  const commodityId = await commodityIdFor(prisma, input.commodity);
  const row = await prisma.mrlRequirement.create({
    data: {
      id: `mrl-${randomUUID()}`,
      buyerName: input.buyerName.trim(),
      commodityId,
      nexteerProductLine: input.nexteerProductLine ?? '',
      ...volumeData(input.volumeByYear),
      partNumber: input.partNumber ?? '',
      partDescription: input.partDescription ?? '',
      mainMaterialsSpecTech: input.mainMaterialsSpecTech ?? '',
      peakVolume: input.peakVolume ?? null,
      program: input.program ?? '',
      eop: input.eop ?? '',
      targetPrice: input.targetPrice ?? null,
      priority: input.priority ?? 2,
      primaryDriver: input.primaryDriver ?? '',
      keyManufacturingCapabilities: input.keyManufacturingCapabilities ?? '',
      safetyCriticalPart: input.safetyCriticalPart ?? false,
      supplierExperienceInSafetyRequired: input.supplierExperienceInSafetyRequired ?? false,
      certifications: input.certifications ?? '',
      knowsCQIs: input.knowsCQIs ?? false,
    },
    include: { commodity: true },
  });
  return toMrlDTO(row);
}

/** Inline edit — accepts any subset of MRL fields. */
export async function updateMrlRequirement(prisma: PrismaClient, id: string, patch: MrlInput) {
  const existing = await prisma.mrlRequirement.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError(`MRL requirement ${id} not found`);

  const data: Prisma.MrlRequirementUpdateInput = {
    ...(patch.buyerName !== undefined ? { buyerName: patch.buyerName } : {}),
    ...(patch.nexteerProductLine !== undefined ? { nexteerProductLine: patch.nexteerProductLine } : {}),
    ...volumeData(patch.volumeByYear),
    ...(patch.partNumber !== undefined ? { partNumber: patch.partNumber } : {}),
    ...(patch.partDescription !== undefined ? { partDescription: patch.partDescription } : {}),
    ...(patch.mainMaterialsSpecTech !== undefined ? { mainMaterialsSpecTech: patch.mainMaterialsSpecTech } : {}),
    ...(patch.peakVolume !== undefined ? { peakVolume: patch.peakVolume } : {}),
    ...(patch.program !== undefined ? { program: patch.program } : {}),
    ...(patch.eop !== undefined ? { eop: patch.eop } : {}),
    ...(patch.targetPrice !== undefined ? { targetPrice: patch.targetPrice } : {}),
    ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
    ...(patch.primaryDriver !== undefined ? { primaryDriver: patch.primaryDriver } : {}),
    ...(patch.keyManufacturingCapabilities !== undefined
      ? { keyManufacturingCapabilities: patch.keyManufacturingCapabilities } : {}),
    ...(patch.safetyCriticalPart !== undefined ? { safetyCriticalPart: patch.safetyCriticalPart } : {}),
    ...(patch.supplierExperienceInSafetyRequired !== undefined
      ? { supplierExperienceInSafetyRequired: patch.supplierExperienceInSafetyRequired } : {}),
    ...(patch.certifications !== undefined ? { certifications: patch.certifications } : {}),
    ...(patch.knowsCQIs !== undefined ? { knowsCQIs: patch.knowsCQIs } : {}),
  };
  if (patch.commodity !== undefined) {
    data.commodity = { connect: { id: await commodityIdFor(prisma, patch.commodity) } };
  }

  const row = await prisma.mrlRequirement.update({ where: { id }, data, include: { commodity: true } });
  return toMrlDTO(row);
}

export async function deleteMrlRequirement(prisma: PrismaClient, id: string) {
  const existing = await prisma.mrlRequirement.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError(`MRL requirement ${id} not found`);
  await prisma.mrlRequirement.delete({ where: { id } });
}
