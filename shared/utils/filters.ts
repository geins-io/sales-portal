/**
 * Shared filter/sort utilities for product list and search pages.
 *
 * Builds a GraphQL FilterInputType object from UI state.
 * The caller is responsible for JSON.stringify when passing as a query param.
 */

/** Sort value map from UI labels to GraphQL SortType enum values. */
export const SORT_MAP: Record<string, string> = {
  relevance: 'RELEVANCE',
  'price-asc': 'PRICE',
  'price-desc': 'PRICE_DESC',
  newest: 'LATEST',
  'name-asc': 'ALPHABETICAL',
};

export interface FilterInput {
  facets?: string[];
  sort?: string;
  searchText?: string;
}

/**
 * Build a filter input object for the GraphQL FilterInputType.
 *
 * Returns `undefined` when no filters, sort, or search text are active
 * (i.e. the default state needs no filter param).
 *
 * @param filterState - Map of facet ID to selected values
 * @param sortBy - Current sort key (e.g. 'price-asc')
 * @param searchText - Optional free-text search within results
 * @param sortMap - Sort key to GraphQL enum mapping (defaults to SORT_MAP)
 */
export function buildFilterInput(
  filterState: Record<string, string[]> | null | undefined,
  sortBy: string,
  searchText?: string,
  sortMap: Record<string, string> = SORT_MAP,
): FilterInput | undefined {
  const facetValues = Object.values(filterState ?? {})
    .flat()
    .filter(Boolean);

  const filter: FilterInput = {};

  if (facetValues.length > 0) filter.facets = facetValues;
  if (searchText) filter.searchText = searchText;
  if (sortBy !== 'relevance') filter.sort = sortMap[sortBy] ?? 'RELEVANCE';

  return Object.keys(filter).length > 0 ? filter : undefined;
}
