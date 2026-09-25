import type { TrackerSupplier } from '../../types';
import { INTELEX_LEVELS } from '../../constants/intelex-levels';
import { SUB_STATUSES, ENTRY_SOURCES } from '../../constants/catalogs';

/**
 * Declarative per-stage filter config for `TrackerStage`.
 *
 * Each entry renders as one more `CatalogSelect` inside the "Filters" panel,
 * under the 5 global filters (Commodity/Buyer/Country/SLA status/Days in
 * stage). `getOptions` derives the dropdown's choices from the suppliers
 * currently loaded for the stage; `matches` decides whether one supplier
 * passes the selected value. Adding a filter to a stage is one array entry —
 * no JSX branching in `TrackerStage.tsx`.
 *
 * `NOT_SET` doubles as both the option's value and its displayed label
 * ("Not set"), so it renders correctly through the plain `CatalogSelect`
 * (`options: readonly string[]`) with no separate value/label plumbing.
 */
export const NOT_SET = 'Not set';

const OTHER_LEVEL = 'Other';

export interface StageFilterDef {
  key: string;
  label: string;
  getOptions: (suppliers: TrackerSupplier[]) => string[];
  matches: (supplier: TrackerSupplier, value: string) => boolean;
}

/** Equality on a nullable string field, with `NOT_SET` standing in for null/empty. */
function nullableEquals(getValue: (s: TrackerSupplier) => string | null) {
  return (supplier: TrackerSupplier, value: string) =>
    value === NOT_SET ? !getValue(supplier) : getValue(supplier) === value;
}

/** Options derived from the values actually present in the loaded suppliers. */
function dynamicOptions(
  suppliers: TrackerSupplier[],
  getValue: (s: TrackerSupplier) => string | null,
  includeNotSet = false,
): string[] {
  const values = suppliers.map(getValue);
  const known = [...new Set(values.filter((v): v is string => !!v))].sort();
  return includeNotSet && values.some(v => !v) ? [...known, NOT_SET] : known;
}

/** Options from a fixed catalog, in catalog order. */
function fixedOptions(values: readonly string[], includeNotSet = false): string[] {
  return includeNotSet ? [...values, NOT_SET] : [...values];
}

function visitStatus(supplier: TrackerSupplier): 'Not planned' | 'Planned' | 'Completed' {
  if (supplier.prelim_visitDateCompleted) return 'Completed';
  if (supplier.prelim_visitDatePlanned) return 'Planned';
  return 'Not planned';
}

export const STAGE_FILTER_CONFIG: Partial<Record<TrackerSupplier['stage'], StageFilterDef[]>> = {
  'Scouting Event': [
    {
      key: 'event',
      label: 'Event',
      getOptions: suppliers => {
        const names = new Set<string>();
        suppliers.forEach(s => s.events.forEach(e => names.add(e.name)));
        return [...names].sort();
      },
      // A supplier matches if ANY of its linked events matches the selected one.
      matches: (supplier, value) => supplier.events.some(e => e.name === value),
    },
    {
      key: 'scoutingPhase',
      label: 'Scouting phase',
      getOptions: () => fixedOptions(['Identified', 'B2B'], true),
      matches: nullableEquals(s => s.scoutingPhase),
    },
  ],

  'Parking Lot': [
    {
      key: 'parkingSubStatus',
      label: 'Sub-status',
      getOptions: () => fixedOptions(SUB_STATUSES, true),
      matches: nullableEquals(s => s.parkingSubStatus),
    },
    {
      key: 'entrySource',
      label: 'Entry source',
      getOptions: () => fixedOptions(ENTRY_SOURCES),
      matches: (supplier, value) => supplier.entrySource === value,
    },
  ],

  'Preliminary Evaluation': [
    {
      key: 'prelim_ssdLeader',
      label: 'SSD Leader',
      getOptions: suppliers => dynamicOptions(suppliers, s => s.prelim_ssdLeader, true),
      matches: nullableEquals(s => s.prelim_ssdLeader),
    },
    {
      key: 'prelim_sdeLeader',
      label: 'SDE Leader',
      getOptions: suppliers => dynamicOptions(suppliers, s => s.prelim_sdeLeader, true),
      matches: nullableEquals(s => s.prelim_sdeLeader),
    },
    {
      key: 'prelim_priority',
      label: 'Priority',
      getOptions: () => fixedOptions(['1', '2', '3'], true),
      matches: nullableEquals(s => (s.prelim_priority == null ? null : String(s.prelim_priority))),
    },
  ],

  'Supplier Evaluation': [
    {
      key: 'prelim_ssdLeader',
      label: 'SSD Leader',
      getOptions: suppliers => dynamicOptions(suppliers, s => s.prelim_ssdLeader, true),
      matches: nullableEquals(s => s.prelim_ssdLeader),
    },
    {
      key: 'visitStatus',
      label: 'Visit status',
      getOptions: () => fixedOptions(['Not planned', 'Planned', 'Completed']),
      matches: (supplier, value) => visitStatus(supplier) === value,
    },
  ],

  'Intelex Handoff': [
    {
      key: 'intelexLevel',
      label: 'Level',
      getOptions: suppliers => {
        const hasOther = suppliers.some(s => !(INTELEX_LEVELS as string[]).includes(s.intelex_currentLevel));
        return hasOther ? [...INTELEX_LEVELS, OTHER_LEVEL] : [...INTELEX_LEVELS];
      },
      matches: (supplier, value) =>
        value === OTHER_LEVEL
          ? !(INTELEX_LEVELS as string[]).includes(supplier.intelex_currentLevel)
          : supplier.intelex_currentLevel === value,
    },
  ],
};
