/**
 * The one text-search predicate the list screens share.
 *
 * Seven pages had independently written the same shape — lowercase the query,
 * then OR a chain of `.includes()` over a handful of fields — each with small
 * variations (some trimmed the query, some did not; some coalesced nulls, some
 * would have thrown on one). What differs legitimately between screens is
 * *which fields are searched*, so that stays at the call site as a selector,
 * and only the matching rule lives here.
 *
 * Rules, applied uniformly now:
 *  - The query is trimmed and lowercased; an empty query matches everything.
 *  - Null/undefined fields are treated as empty rather than throwing.
 *  - Numbers are searched by their string form (e.g. a folio or a day count).
 *  - Matching is case-insensitive substring, not word-prefix — the same
 *    behaviour every screen already had.
 */
export type Searchable = string | number | null | undefined;

/** Lowercased, trimmed query. Hoist this out of a filter loop when reusing it. */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

/**
 * True when any of `fields` contains `normalizedQuery`. Pass the query through
 * `normalizeQuery` once per render, not once per row.
 */
export function matchesQuery(normalizedQuery: string, fields: Searchable[]): boolean {
  if (normalizedQuery === '') return true;
  return fields.some(f =>
    f != null && String(f).toLowerCase().includes(normalizedQuery),
  );
}

/**
 * Convenience wrapper for the common case: filter a list by a raw query and a
 * per-row field selector. Normalises the query once, then tests each row.
 */
export function filterBySearch<T>(
  rows: T[],
  query: string,
  fieldsOf: (row: T) => Searchable[],
): T[] {
  const q = normalizeQuery(query);
  if (q === '') return rows;
  return rows.filter(row => matchesQuery(q, fieldsOf(row)));
}
