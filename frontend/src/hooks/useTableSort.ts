import { useMemo, useState } from 'react';
import { faArrowDown, faArrowUp } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { NEUTRAL_COLORS } from '../constants/designTokens';

export type SortDir = 'asc' | 'desc' | null;

/** What a column's `getValue` may return — the comparator picks its strategy from this. */
export type SortableValue = string | number | Date | null | undefined;

/**
 * The shared three-state sort cycle used across every data table:
 * unsorted (grey up-arrow) → ascending (black up-arrow) → descending (black
 * down-arrow) → unsorted. Clicking a different column always starts it at
 * ascending and resets the previous column to unsorted.
 *
 * `getValue` is called with the raw field name (not just the row) so one
 * table can sort several differently-typed columns through a single switch.
 */
export function useTableSort<T, F extends string>(
  rows: T[],
  getValue: (row: T, field: F) => SortableValue,
) {
  const [sortField, setSortField] = useState<F | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  function handleSort(field: F) {
    if (sortField === field) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') { setSortField(null); setSortDir(null); }
      else setSortDir('asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  const sortedRows = useMemo(() => {
    if (!sortField || !sortDir) return rows;
    return [...rows].sort((a, b) => compareValues(getValue(a, sortField), getValue(b, sortField), sortDir));
    // `getValue` is omitted on purpose: every caller passes an inline arrow that
    // is re-created each render, so including it would defeat the memo entirely.
    // Safe because those closures only read their own `row`/`field` arguments —
    // anything else they could read (e.g. `Reports.tsx`) changes the identity of
    // `rows` at the same time, which is already a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sortField, sortDir]);

  return { sortField, sortDir, handleSort, sortedRows };
}

/** Empty values (null/undefined/'') always sort last, in both directions. */
function compareValues(a: SortableValue, b: SortableValue, dir: 'asc' | 'desc'): number {
  const aEmpty = a === null || a === undefined || a === '';
  const bEmpty = b === null || b === undefined || b === '';
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  let cmp: number;
  if (a instanceof Date || b instanceof Date) {
    cmp = new Date(a as string | Date).getTime() - new Date(b as string | Date).getTime();
  } else if (typeof a === 'number' && typeof b === 'number') {
    cmp = a - b;
  } else {
    cmp = String(a).localeCompare(String(b));
  }
  return dir === 'asc' ? cmp : -cmp;
}

/** The one arrow icon + colour every sortable header cell shows — never two arrows at once. */
export function sortIcon<F extends string>(field: F, sortField: F | null, sortDir: SortDir): { icon: IconDefinition; color: string } {
  if (sortField !== field) return { icon: faArrowUp, color: NEUTRAL_COLORS.border };
  return { icon: sortDir === 'desc' ? faArrowDown : faArrowUp, color: '#000000' };
}
