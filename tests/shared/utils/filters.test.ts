import { describe, it, expect } from 'vitest';
import {
  buildFilterInput,
  SORT_MAP,
  SORT_LABEL_KEYS,
  isPriceFacet,
  isStockFacet,
  normalizeListDefaultSort,
  effectiveListDefaultSort,
  sortValuesFor,
} from '../../../shared/utils/filters';

describe('buildFilterInput', () => {
  it('returns undefined when no filters, default sort, no search', () => {
    expect(buildFilterInput({}, 'relevance')).toBeUndefined();
  });

  it('returns undefined for null filterState', () => {
    expect(buildFilterInput(null, 'relevance')).toBeUndefined();
  });

  it('returns undefined for undefined filterState', () => {
    expect(buildFilterInput(undefined, 'relevance')).toBeUndefined();
  });

  it('flattens a single facet group to a flat string array', () => {
    const result = buildFilterInput(
      { Price: ['price_10000_sek'] },
      'relevance',
    );
    expect(result).toEqual({ facets: ['price_10000_sek'] });
  });

  it('flattens multiple values within a single facet group', () => {
    const result = buildFilterInput({ color: ['red', 'blue'] }, 'relevance');
    expect(result).toEqual({ facets: ['red', 'blue'] });
  });

  it('merges multiple facet groups into a single flat array', () => {
    const result = buildFilterInput(
      { Price: ['price_10000_sek'], Brand: ['b_our-company'] },
      'relevance',
    );
    expect(result).toEqual({
      facets: ['price_10000_sek', 'b_our-company'],
    });
  });

  it('skips facets with empty values array', () => {
    const result = buildFilterInput({ color: [], size: ['L'] }, 'relevance');
    expect(result?.facets).toEqual(['L']);
  });

  it('returns undefined when all facets have empty values', () => {
    expect(
      buildFilterInput({ color: [], size: [] }, 'relevance'),
    ).toBeUndefined();
  });

  it('returns no facets field when filterState is empty', () => {
    const result = buildFilterInput({}, 'price-asc');
    expect(result).toEqual({ sort: 'PRICE' });
    expect(result?.facets).toBeUndefined();
  });

  it('includes sort when not relevance', () => {
    const result = buildFilterInput({}, 'price-asc');
    expect(result).toEqual({ sort: 'PRICE' });
  });

  it('maps price-desc to PRICE_DESC', () => {
    const result = buildFilterInput({}, 'price-desc');
    expect(result?.sort).toBe('PRICE_DESC');
  });

  it('maps newest to LATEST', () => {
    const result = buildFilterInput({}, 'newest');
    expect(result?.sort).toBe('LATEST');
  });

  it('falls back to RELEVANCE for unknown sort key', () => {
    const result = buildFilterInput({}, 'unknown-sort');
    expect(result?.sort).toBe('RELEVANCE');
  });

  it('includes searchText when provided', () => {
    const result = buildFilterInput({}, 'relevance', 'shoes');
    expect(result).toEqual({ searchText: 'shoes' });
  });

  it('does not include searchText when empty string', () => {
    expect(buildFilterInput({}, 'relevance', '')).toBeUndefined();
  });

  it('combines facets, sort, and searchText', () => {
    const result = buildFilterInput(
      { brand: ['nike'] },
      'price-asc',
      'running',
    );
    expect(result).toEqual({
      facets: ['nike'],
      sort: 'PRICE',
      searchText: 'running',
    });
  });

  it('accepts a custom sort map', () => {
    const customMap = { custom: 'CUSTOM_SORT' };
    const result = buildFilterInput({}, 'custom', undefined, customMap);
    expect(result?.sort).toBe('CUSTOM_SORT');
  });
});

describe('isPriceFacet', () => {
  it('returns true for exact type and filterId "Price"', () => {
    expect(isPriceFacet({ type: 'Price', filterId: 'Price' })).toBe(true);
  });

  it('returns true for lowercase type and filterId "price"', () => {
    expect(isPriceFacet({ type: 'price', filterId: 'price' })).toBe(true);
  });

  it('returns true when filterId matches even if type differs', () => {
    expect(isPriceFacet({ type: 'Other', filterId: 'Price' })).toBe(true);
  });

  it('returns true when group matches even if type and filterId differ', () => {
    expect(
      isPriceFacet({ type: 'Other', filterId: 'Other', group: 'Price' }),
    ).toBe(true);
  });

  it('returns false for Brand', () => {
    expect(isPriceFacet({ type: 'Brand', filterId: 'Brand' })).toBe(false);
  });

  it('returns false for Category', () => {
    expect(isPriceFacet({ type: 'Category', filterId: 'Category' })).toBe(
      false,
    );
  });

  it('returns false for Sku', () => {
    expect(isPriceFacet({ type: 'Sku', filterId: 'Sku' })).toBe(false);
  });

  it('returns false for empty type and filterId', () => {
    expect(isPriceFacet({ type: '', filterId: '' })).toBe(false);
  });

  it('does not throw when group is null', () => {
    expect(() =>
      isPriceFacet({ type: 'Brand', filterId: 'Brand', group: null }),
    ).not.toThrow();
  });

  it('does not throw when group is undefined', () => {
    expect(() =>
      isPriceFacet({ type: 'Brand', filterId: 'Brand' }),
    ).not.toThrow();
  });

  it('returns false for type "priceless" (no substring match)', () => {
    expect(isPriceFacet({ type: 'priceless', filterId: 'priceless' })).toBe(
      false,
    );
  });

  it('returns false for type "priced" (no substring match)', () => {
    expect(isPriceFacet({ type: 'priced', filterId: 'priced' })).toBe(false);
  });

  it('returns true when group is "  Price " (leading/trailing whitespace)', () => {
    expect(
      isPriceFacet({ type: 'Other', filterId: 'Other', group: '  Price ' }),
    ).toBe(true);
  });
});

describe('isStockFacet', () => {
  it('returns true for type "StockStatus"', () => {
    expect(isStockFacet({ type: 'StockStatus', filterId: 'StockStatus' })).toBe(
      true,
    );
  });

  it('returns true when filterId is "StockStatus"', () => {
    expect(isStockFacet({ type: 'Other', filterId: 'StockStatus' })).toBe(true);
  });

  it('returns true for label-style "Stock status" (space-separated) via filterId', () => {
    expect(
      isStockFacet({ type: 'Stock status', filterId: 'Stock status' }),
    ).toBe(true);
  });

  it('returns true for underscore variant "stock_status" via filterId', () => {
    expect(
      isStockFacet({ type: 'stock_status', filterId: 'stock_status' }),
    ).toBe(true);
  });

  it('returns false for Brand', () => {
    expect(isStockFacet({ type: 'Brand', filterId: 'Brand' })).toBe(false);
  });

  it('returns false for Category', () => {
    expect(isStockFacet({ type: 'Category', filterId: 'Category' })).toBe(
      false,
    );
  });

  it('returns false for Sku', () => {
    expect(isStockFacet({ type: 'Sku', filterId: 'Sku' })).toBe(false);
  });

  it('returns false for Price', () => {
    expect(isStockFacet({ type: 'Price', filterId: 'Price' })).toBe(false);
  });

  it('returns false for empty type and filterId', () => {
    expect(isStockFacet({ type: '', filterId: '' })).toBe(false);
  });

  it('does not throw when group is null', () => {
    expect(() =>
      isStockFacet({ type: 'Brand', filterId: 'Brand', group: null }),
    ).not.toThrow();
  });

  it('does not throw when group is undefined', () => {
    expect(() =>
      isStockFacet({ type: 'Brand', filterId: 'Brand' }),
    ).not.toThrow();
  });

  it('returns false for type "stocking" (no substring match)', () => {
    expect(isStockFacet({ type: 'stocking', filterId: 'stocking' })).toBe(
      false,
    );
  });
});

describe('SORT_MAP', () => {
  it('maps all expected UI sort values', () => {
    expect(SORT_MAP['relevance']).toBe('RELEVANCE');
    expect(SORT_MAP['price-asc']).toBe('PRICE');
    expect(SORT_MAP['price-desc']).toBe('PRICE_DESC');
    expect(SORT_MAP['newest']).toBe('LATEST');
    expect(SORT_MAP['name-asc']).toBe('ALPHABETICAL');
    expect(SORT_MAP['name-desc']).toBe('ALPHABETICAL_DESC');
  });

  it('sends ALPHABETICAL_DESC for name-desc', () => {
    expect(buildFilterInput({}, 'name-desc')?.sort).toBe('ALPHABETICAL_DESC');
  });
});

describe('sortValuesFor', () => {
  it('offers lists A-Ö, Ö-A, newest and both prices, without relevance', () => {
    expect(sortValuesFor('list', true)).toEqual([
      'name-asc',
      'name-desc',
      'newest',
      'price-asc',
      'price-desc',
    ]);
  });

  it('drops the price sorts from lists when prices are hidden', () => {
    expect(sortValuesFor('list', false)).toEqual([
      'name-asc',
      'name-desc',
      'newest',
    ]);
  });

  it('offers search relevance first, then the list sorts', () => {
    expect(sortValuesFor('search', true)).toEqual([
      'relevance',
      'name-asc',
      'name-desc',
      'newest',
      'price-asc',
      'price-desc',
    ]);
  });

  it('drops the price sorts from search when prices are hidden', () => {
    expect(sortValuesFor('search', false)).toEqual([
      'relevance',
      'name-asc',
      'name-desc',
      'newest',
    ]);
  });

  it('offers only values that SORT_MAP sends and that have a label', () => {
    for (const value of sortValuesFor('search', true)) {
      expect(SORT_MAP[value]).toBeDefined();
      expect(SORT_LABEL_KEYS[value]).toMatch(/^product\.sort_/);
    }
  });

  it('labels each value with its own key', () => {
    expect(SORT_LABEL_KEYS).toEqual({
      relevance: 'product.sort_relevance',
      'name-asc': 'product.sort_name_asc',
      'name-desc': 'product.sort_name_desc',
      newest: 'product.sort_newest',
      'price-asc': 'product.sort_price_asc',
      'price-desc': 'product.sort_price_desc',
    });
  });
});

describe('normalizeListDefaultSort', () => {
  it.each(['name-asc', 'name-desc', 'newest', 'price-asc', 'price-desc'])(
    'keeps %s',
    (value) => {
      expect(normalizeListDefaultSort(value)).toBe(value);
    },
  );

  it.each([undefined, null, '', 'relevance', 'bogus', 5, {}])(
    'turns %s into name-asc',
    (value) => {
      expect(normalizeListDefaultSort(value)).toBe('name-asc');
    },
  );
});

describe('effectiveListDefaultSort', () => {
  it('is the setting when prices are visible', () => {
    expect(effectiveListDefaultSort('price-desc', true)).toBe('price-desc');
  });

  it.each(['price-asc', 'price-desc'])(
    'falls back to name-asc for %s when prices are hidden',
    (value) => {
      expect(effectiveListDefaultSort(value, false)).toBe('name-asc');
    },
  );

  it('keeps a non-price setting when prices are hidden', () => {
    expect(effectiveListDefaultSort('newest', false)).toBe('newest');
  });

  it('is name-asc for a missing or unknown setting', () => {
    expect(effectiveListDefaultSort(undefined, true)).toBe('name-asc');
    expect(effectiveListDefaultSort('relevance', true)).toBe('name-asc');
  });
});
