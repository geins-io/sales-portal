import { describe, it, expect } from 'vitest';
import {
  buildFilterInput,
  SORT_MAP,
  isPriceFacet,
  isStockFacet,
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
});

describe('SORT_MAP', () => {
  it('maps all expected UI sort values', () => {
    expect(SORT_MAP['relevance']).toBe('RELEVANCE');
    expect(SORT_MAP['price-asc']).toBe('PRICE');
    expect(SORT_MAP['price-desc']).toBe('PRICE_DESC');
    expect(SORT_MAP['newest']).toBe('LATEST');
    expect(SORT_MAP['name-asc']).toBe('ALPHABETICAL');
  });

  it('does not include name-desc (no API support for descending alphabetical)', () => {
    expect(SORT_MAP['name-desc']).toBeUndefined();
  });

  it('falls back to RELEVANCE when name-desc is used in buildFilterInput', () => {
    const result = buildFilterInput({}, 'name-desc');
    expect(result?.sort).toBe('RELEVANCE');
  });
});
