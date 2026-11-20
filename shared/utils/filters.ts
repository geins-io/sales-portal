/**
 * Shared filter/sort utilities for product list and search pages.
 *
 * Builds a GraphQL FilterInputType object from UI state.
 * The caller is responsible for JSON.stringify when passing as a query param.
 */
import type { FilterFacet } from '#shared/types/commerce';

type FacetIdentity = Pick<FilterFacet, 'type' | 'filterId'> & {
  group?: string | null;
};

function normalize(s?: string | null): string {
  if (s == null) return '';
  return s
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '');
}

export function isPriceFacet(facet: FacetIdentity): boolean {
  return (
    normalize(facet.type) === 'price' ||
    normalize(facet.filterId) === 'price' ||
    normalize(facet.group) === 'price'
  );
}

export function isStockFacet(facet: FacetIdentity): boolean {
  return (
    normalize(facet.type) === 'stockstatus' ||
    normalize(facet.filterId) === 'stockstatus' ||
    normalize(facet.group) === 'stockstatus'
  );
}

/** Sort value map from UI labels to GraphQL SortType enum values. */
export const SORT_MAP: Record<string, string> = {
  relevance: 'RELEVANCE',
  'price-asc': 'PRICE',
  'price-desc': 'PRICE_DESC',
  newest: 'LATEST',
  'name-asc': 'ALPHABETICAL',
  'name-desc': 'ALPHABETICAL_DESC',
};

/** i18n label key for each sort value a page offers. */
export const SORT_LABEL_KEYS: Record<SortValue, string> = {
  relevance: 'product.sort_relevance',
  'name-asc': 'product.sort_name_asc',
  'name-desc': 'product.sort_name_desc',
  newest: 'product.sort_newest',
  'price-asc': 'product.sort_price_asc',
  'price-desc': 'product.sort_price_desc',
};

/**
 * Sorts a product list (category, brand, `/products`) offers, and the values
 * the store setting `productList.defaultSort` accepts. Relevance is search
 * only: without a search term the API returns a different order on every read.
 */
export const LIST_SORTS = [
  'name-asc',
  'name-desc',
  'newest',
  'price-asc',
  'price-desc',
] as const;
export type ListSort = (typeof LIST_SORTS)[number];
export type SortValue = ListSort | 'relevance';

const PRICE_SORTS: ReadonlySet<string> = new Set(['price-asc', 'price-desc']);

/** The sort values a page offers; price sorts only while prices show. */
export function sortValuesFor(
  page: 'list' | 'search',
  showPrice: boolean,
): SortValue[] {
  const values: readonly SortValue[] =
    page === 'search' ? ['relevance', ...LIST_SORTS] : LIST_SORTS;
  return values.filter((value) => showPrice || !PRICE_SORTS.has(value));
}

/** The stored default sort, or A-Ö when it is unset or not a list sort. */
export function normalizeListDefaultSort(raw: unknown): ListSort {
  return LIST_SORTS.find((value) => value === raw) ?? 'name-asc';
}

/** The default a visitor gets: a price default needs visible prices. */
export function effectiveListDefaultSort(
  setting: unknown,
  showPrice: boolean,
): ListSort {
  const sort = normalizeListDefaultSort(setting);
  return !showPrice && PRICE_SORTS.has(sort) ? 'name-asc' : sort;
}

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
