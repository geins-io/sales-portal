import { describe, it, expect } from 'vitest';
import { ProductListSchema } from '../../../../server/schemas/api-input';

describe('ProductListSchema filter parsing (regression)', () => {
  it('parses filter with facets from JSON string', () => {
    // Regression: filter was sent as a flat array instead of {facets: [...]}
    // The schema must accept a JSON string and parse it into the correct shape.
    const input = {
      categoryAlias: 'shoes',
      skip: 0,
      take: 24,
      filter: '{"facets":[{"filterId":"color","values":["red"]}]}',
    };

    const result = ProductListSchema.parse(input);

    expect(result.filter).toEqual({
      facets: [{ filterId: 'color', values: ['red'] }],
    });
    expect(result.filter!.facets).toBeInstanceOf(Array);
    expect(result.filter!.facets[0]).toHaveProperty('filterId', 'color');
    expect(result.filter!.facets[0]).toHaveProperty('values', ['red']);
  });

  it('parses filter with searchText from JSON string', () => {
    const input = {
      categoryAlias: 'shoes',
      filter: '{"searchText":"running"}',
    };

    const result = ProductListSchema.parse(input);

    expect(result.filter).toEqual({ searchText: 'running' });
  });

  it('parses filter with sort from JSON string', () => {
    const input = {
      categoryAlias: 'shoes',
      filter: '{"sort":"PRICE"}',
    };

    const result = ProductListSchema.parse(input);

    expect(result.filter).toEqual({ sort: 'PRICE' });
  });

  it('accepts filter as an object (not just string)', () => {
    const input = {
      categoryAlias: 'shoes',
      filter: { facets: [{ filterId: 'size', values: ['42'] }] },
    };

    const result = ProductListSchema.parse(input);

    expect(result.filter).toEqual({
      facets: [{ filterId: 'size', values: ['42'] }],
    });
  });

  it('accepts undefined filter (no filters applied)', () => {
    const input = {
      categoryAlias: 'shoes',
      skip: 0,
      take: 24,
    };

    const result = ProductListSchema.parse(input);

    expect(result.filter).toBeUndefined();
  });

  it('rejects invalid JSON string in filter', () => {
    const input = {
      categoryAlias: 'shoes',
      filter: 'not-valid-json',
    };

    expect(() => ProductListSchema.parse(input)).toThrow();
  });

  it('parses combined facets, searchText, and sort filter', () => {
    const filterObj = {
      facets: [{ filterId: 'color', values: ['red', 'blue'] }],
      searchText: 'shoes',
      sort: 'PRICE',
    };

    const input = {
      categoryAlias: 'shoes',
      filter: JSON.stringify(filterObj),
    };

    const result = ProductListSchema.parse(input);

    expect(result.filter).toEqual(filterObj);
  });
});
