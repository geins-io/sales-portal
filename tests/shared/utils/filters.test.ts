import { describe, it, expect } from 'vitest';
import { buildFilterInput, SORT_MAP } from '../../../shared/utils/filters';

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

  it('includes facets when filters are active', () => {
    const result = buildFilterInput({ color: ['red', 'blue'] }, 'relevance');
    expect(result).toEqual({
      facets: [{ filterId: 'color', values: ['red', 'blue'] }],
    });
  });

  it('includes multiple facets', () => {
    const result = buildFilterInput(
      { color: ['red'], size: ['L', 'XL'] },
      'relevance',
    );
    expect(result?.facets).toHaveLength(2);
    expect(result?.facets).toContainEqual({
      filterId: 'color',
      values: ['red'],
    });
    expect(result?.facets).toContainEqual({
      filterId: 'size',
      values: ['L', 'XL'],
    });
  });

  it('skips facets with empty values array', () => {
    const result = buildFilterInput({ color: [], size: ['L'] }, 'relevance');
    expect(result?.facets).toEqual([{ filterId: 'size', values: ['L'] }]);
  });

  it('returns undefined when all facets have empty values', () => {
    expect(
      buildFilterInput({ color: [], size: [] }, 'relevance'),
    ).toBeUndefined();
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
      facets: [{ filterId: 'brand', values: ['nike'] }],
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

describe('SORT_MAP', () => {
  it('maps all expected UI sort values', () => {
    expect(SORT_MAP['relevance']).toBe('RELEVANCE');
    expect(SORT_MAP['price-asc']).toBe('PRICE');
    expect(SORT_MAP['price-desc']).toBe('PRICE_DESC');
    expect(SORT_MAP['newest']).toBe('LATEST');
    expect(SORT_MAP['name-asc']).toBe('ALPHABETICAL');
    expect(SORT_MAP['name-desc']).toBe('ALPHABETICAL');
  });
});
