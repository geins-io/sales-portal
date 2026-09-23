import { describe, it, expect } from 'vitest';
import {
  dimensionsOf,
  resolveCombination,
  variantCombinations,
  type VariantCombination,
} from '../../app/utils/variant-tree';
import { oneDimensionTree, twoDimensionTree } from '../fixtures/variant-trees';

describe('variantCombinations', () => {
  it('yields one combination per top node when there is one dimension', () => {
    const combos = variantCombinations(oneDimensionTree);

    expect(combos.map((c) => [c.alias, c.selection])).toEqual([
      ['glidlager-brons-20-mm', { Dimension: '20 mm' }],
      ['glidlager-brons-25-mm', { Dimension: '25 mm' }],
    ]);
    expect(combos.map((c) => c.productId)).toEqual([1075, 1076]);
    expect(combos[0]!.stock?.totalStock).toBe(4);
  });

  it('carries the whole path down to the product node on two dimensions', () => {
    const combos = variantCombinations(twoDimensionTree);

    expect(combos.map((c) => [c.alias, c.selection])).toEqual([
      [
        'sexkantskruv-m10x50-din-933-rostfri-a2',
        { Gänga: 'm10', Längd: '50 mm' },
      ],
      [
        'sexkantskruv-m12x60-din-933-rostfri-a2',
        { Gänga: 'm12', Längd: '60 mm' },
      ],
      [
        'sexkantskruv-m8x40-din-933-rostfri-a2',
        { Gänga: 'm8', Längd: '40 mm' },
      ],
    ]);
    expect(combos[1]!.labels).toEqual({ Gänga: 'M12', Längd: '60 mm' });
  });

  it('takes the label as the value when a node has no value', () => {
    const combos = variantCombinations([
      { alias: 'a', dimension: 'Variant', label: '88' },
    ]);

    expect(combos[0]!.selection).toEqual({ Variant: '88' });
  });

  it('returns nothing for a missing or alias-less group', () => {
    expect(variantCombinations(undefined)).toEqual([]);
    expect(
      variantCombinations([{ dimension: 'Gänga', value: 'm10', variants: [] }]),
    ).toEqual([]);
  });
});

describe('resolveCombination', () => {
  const two = variantCombinations(twoDimensionTree);
  const current = { Gänga: 'm12', Längd: '60 mm' };

  it('resolves a pick on the top dimension to the product below it', () => {
    expect(resolveCombination(two, current, 'Gänga', 'm10')?.alias).toBe(
      'sexkantskruv-m10x50-din-933-rostfri-a2',
    );
  });

  it('resolves a pick on the second dimension across top nodes', () => {
    expect(resolveCombination(two, current, 'Längd', '40 mm')?.alias).toBe(
      'sexkantskruv-m8x40-din-933-rostfri-a2',
    );
  });

  it('prefers the variant that keeps the other dimensions, then payload order', () => {
    const combo = (
      alias: string,
      selection: Record<string, string>,
    ): VariantCombination => ({
      alias,
      productId: null,
      selection,
      labels: selection,
      stock: null,
    });
    const grid = [
      combo('red-s', { Color: 'red', Size: 's' }),
      combo('blue-s', { Color: 'blue', Size: 's' }),
      combo('blue-m', { Color: 'blue', Size: 'm' }),
      combo('blue-m-2', { Color: 'blue', Size: 'm' }),
    ];

    expect(
      resolveCombination(grid, { Color: 'red', Size: 'm' }, 'Color', 'blue')
        ?.alias,
    ).toBe('blue-m');
    expect(
      resolveCombination(grid, { Color: 'red', Size: 'l' }, 'Color', 'blue')
        ?.alias,
    ).toBe('blue-s');
  });

  it('returns null for a value no variant has', () => {
    expect(resolveCombination(two, current, 'Gänga', 'm99')).toBeNull();
  });

  it('keeps the current product for its own value on one dimension', () => {
    const one = variantCombinations(oneDimensionTree);
    expect(
      resolveCombination(one, { Dimension: '25 mm' }, 'Dimension', '25 mm')
        ?.alias,
    ).toBe('glidlager-brons-25-mm');
  });
});

describe('dimensionsOf', () => {
  it('lists every value of every dimension, top dimension first', () => {
    expect(dimensionsOf(variantCombinations(twoDimensionTree))).toEqual([
      {
        dimensionName: 'Gänga',
        values: [
          { value: 'm10', label: 'M10' },
          { value: 'm12', label: 'M12' },
          { value: 'm8', label: 'M8' },
        ],
      },
      {
        dimensionName: 'Längd',
        values: [
          { value: '50 mm', label: '50 mm' },
          { value: '60 mm', label: '60 mm' },
          { value: '40 mm', label: '40 mm' },
        ],
      },
    ]);
  });
});
