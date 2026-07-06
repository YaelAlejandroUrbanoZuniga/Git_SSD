import { Prisma } from '@prisma/client';

// Prisma include that loads everything needed to rebuild the flat
// PipelineSupplier object the frontend consumes.
export const supplierInclude = {
  commodity: true,
  companyInfo: true,
  technicalInfo: true,
  commercialInfo: true,
  documents: true,
  notes: { orderBy: { createdAt: 'asc' } },
  history: { orderBy: { id: 'asc' } },
  parts: true,
  prelimParts: true,
  scoutingData: true,
  parkingData: true,
  preliminaryData: true,
  supplierEvalData: true,
  intelexData: true,
  blacklistEntry: true,
  completionEntry: true,
} satisfies Prisma.SupplierInclude;

export type SupplierWithRelations = Prisma.SupplierGetPayload<{
  include: typeof supplierInclude;
}>;

/**
 * Rebuilds the flat PipelineSupplier wire shape (plus BlacklistedSupplier /
 * CompletedSupplier extensions when the exit-branch rows exist).
 * Field-for-field mirror of src/types/index.ts in the frontend.
 *
 * The object below is built in the same section order as the frontend type:
 * core fields, company/technical/commercial info, documents, cross-stage
 * evaluation summary, history, notes, then one block per pipeline stage
 * satellite (scouting → parking → preliminary → supplier eval → intelex),
 * each guarded by optional chaining since the satellite row may not exist yet.
 */
export function toSupplierDTO(s: SupplierWithRelations): Record<string, unknown> {
  const sc = s.scoutingData;
  const pk = s.parkingData;
  const pre = s.preliminaryData;
  const se = s.supplierEvalData;
  const ix = s.intelexData;

  const dto: Record<string, unknown> = {
    id: s.id,
    folio: s.folio,
    name: s.name,
    stage: s.stage,
    scoutingPhase: s.scoutingPhase,
    entrySource: s.entrySource,
    commodity: s.commodity.name,
    productCategory: s.productCategory,
    productType: s.productType,
    country: s.country,
    manufacturingAddress: s.manufacturingAddress,
    buyer: s.buyer,
    scoutingInput: s.scoutingInput,
    daysInStage: s.daysInStage,
    daysSinceParkingLot: s.daysSinceParkingLot,
    docsPercent: s.docsPercent,
    sla: s.sla,
    globalSla: s.globalSla,
    subStatus: s.subStatus,

    fullName: s.companyInfo?.fullName ?? s.name,
    dunsNumber: s.companyInfo?.dunsNumber ?? '',
    taxIdNumber: s.companyInfo?.taxIdNumber ?? null,
    recommendedBy: s.companyInfo?.recommendedBy ?? null,
    recommenderDept: s.companyInfo?.recommenderDept ?? null,
    companyType: s.companyInfo?.companyType ?? '',
    foundedYear: s.companyInfo?.foundedYear ?? 0,
    headquarters: s.companyInfo?.headquarters ?? '',
    website: s.companyInfo?.website ?? '',
    phone: s.companyInfo?.phone ?? '',
    contactEmail: s.companyInfo?.contactEmail ?? '',
    contactName: s.companyInfo?.contactName ?? '',

    technology: s.technicalInfo?.technology ?? '',
    machineryType: s.technicalInfo?.machineryType ?? '',
    processMethod: s.technicalInfo?.processMethod ?? '',
    pressCapacity: s.technicalInfo?.pressCapacity ?? '',
    materials: s.technicalInfo?.materials ?? '',
    complementaryOperations: s.technicalInfo?.complementaryOperations ?? null,
    safetyCritical: s.technicalInfo?.safetyCritical ?? false,
    safetyExperience: s.technicalInfo?.safetyExperience ?? false,
    certifications: s.technicalInfo?.certifications ?? '',
    knowsCQIs: s.technicalInfo?.knowsCQIs ?? false,

    annualRevenue: s.commercialInfo?.annualRevenue ?? '',
    productionVolume: s.commercialInfo?.productionVolume ?? '',
    employees: s.commercialInfo?.employees ?? 0,
    facilities: s.commercialInfo?.facilities ?? 0,
    topCustomers: s.commercialInfo?.topCustomers ?? '',
    hasIMMEX: s.commercialInfo?.hasIMMEX ?? false,
    planIMMEX: s.commercialInfo?.planIMMEX ?? false,
    exportCapability: s.commercialInfo?.exportCapability ?? false,

    strengths: s.commercialInfo?.strengths ?? '',
    weaknesses: s.commercialInfo?.weaknesses ?? '',
    observations: s.commercialInfo?.observations ?? '',
    recommendations: s.commercialInfo?.recommendations ?? '',
    priority: s.commercialInfo?.priority ?? 2,
    primaryDriver: s.commercialInfo?.primaryDriver ?? '',
    confidenceLevel: s.commercialInfo?.confidenceLevel ?? 'Medium',

    documents: s.documents.map(d => ({
      name: d.name,
      status: d.status,
      ...(d.date != null ? { date: d.date } : {}),
      ...(d.link != null ? { link: d.link } : {}),
    })),

    preEvalStartDate: s.preEvalStartDate,
    parts: s.parts.map(p => ({
      partNumber: p.partNumber,
      partDescription: p.partDescription,
      pl: p.pl,
      peakVolume: p.peakVolume,
      program: p.program,
      eop: p.eop,
      targetPrice: p.targetPrice,
      rfqPrice: p.rfqPrice,
      confidence: p.confidence,
    })),
    initialQuoteSubmitted: s.initialQuoteSubmitted,
    qadPrice: s.qadPrice,
    savingExpected: s.savingExpected,
    tooling: s.tooling,
    selectedForDevelopment: s.selectedForDevelopment,
    investigateRecordNumber: s.investigateRecordNumber,
    intelexDate: s.intelexDate,

    history: s.history.map(h => ({
      date: h.date,
      action: h.action,
      user: h.user,
      role: h.role,
      ...(h.note != null ? { note: h.note } : {}),
    })),

    notes: s.notes.map(n => ({
      id: n.id,
      text: n.text,
      author: n.author,
      role: n.role,
      date: n.date,
      stage: n.stage,
    })),

    scoutingTabsCompleted: {
      scoutingEvent: sc?.tabScoutingEvent ?? false,
      supplierInfo: sc?.tabSupplierInfo ?? false,
      attendees: sc?.tabAttendees ?? false,
      agenda: sc?.tabAgenda ?? false,
      nextStep: sc?.tabNextStep ?? false,
    },
    b2bStatus: sc?.b2bStatus ?? null,
    b2bWhoAttends: sc?.b2bWhoAttends ?? null,
    b2bManager: sc?.b2bManager ?? null,
    b2bBuyer: sc?.b2bBuyer ?? null,
    b2bComments: sc?.b2bComments ?? null,
    agendaStatus: sc?.agendaStatus ?? null,
    agendaTeamsLink: sc?.agendaTeamsLink ?? null,
    agendaScheduledDate: sc?.agendaScheduledDate ?? null,
    agendaTimezone: sc?.agendaTimezone ?? null,
    agendaStand: sc?.agendaStand ?? null,
    agendaStartTime: sc?.agendaStartTime ?? null,
    agendaEndTime: sc?.agendaEndTime ?? null,
    agendaDuration: sc?.agendaDuration ?? null,
    selectedForParking: sc?.selectedForParking ?? null,
    selectionReason: sc?.selectionReason ?? null,

    parkingOnboardingDate: pk?.onboardingDate ?? null,
    parkingTimeless: pk?.timeless ?? false,
    parkingDateToMovePreliminary: pk?.dateToMovePreliminary ?? null,
    parkingDaysElapsed: pk?.daysElapsed ?? null,
    parkingScoutingInput: pk?.scoutingInput ?? null,
    parkingSubStatus: pk?.subStatus ?? null,
    parkingIsRecommendation: pk?.isRecommendation ?? false,
    parkingBuyer: pk?.buyer ?? null,
    parkingCompanyName: pk?.companyName ?? null,
    parkingB2BMeeting: pk?.b2bMeeting ?? null,
    parkingName1: pk?.name1 ?? null,
    parkingWebsite: pk?.website ?? null,
    parkingEmail1: pk?.email1 ?? null,
    parkingPhone: pk?.phone ?? null,
    parkingCommodity: pk?.commodity ?? null,
    parkingProductType: pk?.productType ?? null,
    parkingManufacturingCountry: pk?.manufacturingCountry ?? null,
    parkingManufacturingAddress: pk?.manufacturingAddress ?? null,
    parkingAdditionalComments: pk?.additionalComments ?? null,
    parkingTabsCompleted:
      pk?.hasTabs
        ? { overview: pk.tabOverview, contact: pk.tabContact, details: pk.tabDetails }
        : null,

    preliminaryTabsCompleted:
      pre?.hasTabs
        ? { overview: pre.tabOverview, capabilities: pre.tabCapabilities, visit: pre.tabVisit }
        : null,

    supplierEvalTabsCompleted:
      se?.hasTabs
        ? { competitiveness: se.tabCompetitiveness, fundamentals: se.tabFundamentals }
        : null,

    intelexTabsCompleted:
      ix?.hasTabs
        ? { record: ix.tabRecord, timeline: ix.tabTimeline, efficiency: ix.tabEfficiency }
        : null,
    intelexSaved: ix?.saved ?? false,
    intelex_recordCreationDate: ix?.recordCreationDate ?? null,
    intelex_investigateRecordNumber: ix?.investigateRecordNumber ?? null,
    intelex_investigateExpected: ix?.investigateExpected ?? null,
    intelex_investigateReal: ix?.investigateReal ?? null,
    intelex_l0Expected: ix?.l0Expected ?? null,
    intelex_l0Real: ix?.l0Real ?? null,
    intelex_l1Expected: ix?.l1Expected ?? null,
    intelex_l1Real: ix?.l1Real ?? null,
    intelex_l2Expected: ix?.l2Expected ?? null,
    intelex_l2Real: ix?.l2Real ?? null,
    intelex_l3Expected: ix?.l3Expected ?? null,
    intelex_l3Real: ix?.l3Real ?? null,
    intelex_l4Expected: ix?.l4Expected ?? null,
    intelex_l4Real: ix?.l4Real ?? null,
    intelex_efficiencyL0: ix?.efficiencyL0 ?? null,
    intelex_efficiencyL1: ix?.efficiencyL1 ?? null,
    intelex_efficiencyL2: ix?.efficiencyL2 ?? null,
    intelex_efficiencyL3: ix?.efficiencyL3 ?? null,
    intelex_efficiencyL4: ix?.efficiencyL4 ?? null,

    prelim_startDate: pre?.startDate ?? null,
    prelim_priority: pre?.priority ?? null,
    prelim_scoutingInput: pre?.scoutingInput ?? null,
    prelim_buyer: pre?.buyer ?? null,
    prelim_commodity: pre?.commodity ?? null,
    prelim_primaryDriver: pre?.primaryDriver ?? null,
    prelim_companyName: pre?.companyName ?? null,
    prelim_dunsNumber: pre?.dunsNumber ?? null,
    prelim_hqAddress: pre?.hqAddress ?? null,
    prelim_hqCity: pre?.hqCity ?? null,
    prelim_hqCountry: pre?.hqCountry ?? null,
    prelim_manufacturingAddress: pre?.manufacturingAddress ?? null,
    prelim_manufacturingCity: pre?.manufacturingCity ?? null,
    prelim_manufacturingCountry: pre?.manufacturingCountry ?? null,
    prelim_companyType: pre?.companyType ?? null,
    prelim_foundedYear: pre?.foundedYear ?? null,
    prelim_footprint: pre?.footprint ?? null,
    prelim_yearsInMexico: pre?.yearsInMexico ?? null,
    prelim_facilities: pre?.facilities ?? null,
    prelim_employees: pre?.employees ?? null,
    prelim_annualRevenue: pre?.annualRevenue ?? null,
    prelim_productionVolume: pre?.productionVolume ?? null,
    prelim_mainTechnology: pre?.mainTechnology ?? null,
    prelim_pressCapacity: pre?.pressCapacity ?? null,
    prelim_generalManager: pre?.generalManager ?? null,
    prelim_market: pre?.market ?? null,
    prelim_topCustomers: pre?.topCustomers ?? null,
    prelim_exportCapability: pre?.exportCapability ?? null,
    prelim_certifications: pre?.certifications ?? null,
    prelim_hasIMMEX: pre?.hasIMMEX ?? null,
    prelim_planToGetIMMEX: pre?.planToGetIMMEX ?? null,
    prelim_machineryType: pre?.machineryType ?? null,
    prelim_processingMethod: pre?.processingMethod ?? null,
    prelim_complementaryOps: pre?.complementaryOps ?? null,
    prelim_toolingDesign: pre?.toolingDesign ?? null,
    prelim_materials: pre?.materials ?? null,
    prelim_rawMaterialIndex: pre?.rawMaterialIndex ?? null,
    prelim_applications: pre?.applications ?? null,
    prelim_visitDatePlanned: pre?.visitDatePlanned ?? null,
    prelim_visitDateCompleted: pre?.visitDateCompleted ?? null,
    prelim_visitParticipants: pre?.visitParticipants ?? null,
    prelim_strengths: pre?.strengths ?? null,
    prelim_weaknesses: pre?.weaknesses ?? null,
    prelim_observations: pre?.observations ?? null,
    prelim_recommendations: pre?.recommendations ?? null,

    prelim_parts: s.prelimParts.map(p => ({
      partNumber: p.partNumber,
      partDescription: p.partDescription,
      pl: p.pl,
      annualPeakVolume: p.annualPeakVolume,
      program: p.program,
      eop: p.eop,
      initialQuote: p.initialQuote,
      qadPrice: p.qadPrice,
      delta: p.delta,
      tooling: p.tooling,
      savingExpected: p.savingExpected,
      confidence: p.confidence,
    })),
    prelim_rfqReceived: se?.rfqReceived ?? null,
    prelim_ndaSigned: se?.ndaSigned ?? null,
    prelim_tcsSigned: se?.tcsSigned ?? null,
    prelim_ttcsSigned: se?.ttcsSigned ?? null,
    prelim_nsrSigned: se?.nsrSigned ?? null,
    prelim_sdaSigned: se?.sdaSigned ?? null,

    onboardingDate: s.onboardingDate,
  };

  if (s.blacklistEntry) {
    dto.rejectedBy = s.blacklistEntry.rejectedBy;
    dto.rejectionDate = s.blacklistEntry.rejectionDate;
    dto.rejectionReason = s.blacklistEntry.rejectionReason;
  }
  if (s.completionEntry) {
    dto.completedDate = s.completionEntry.completedDate;
    dto.completedBy = s.completionEntry.completedBy;
  }
  return dto;
}
