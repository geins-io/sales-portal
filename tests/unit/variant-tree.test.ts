import { describe, it, expect } from 'vitest';
import {
  changeGroups,
  combinationExists,
  dimensionsOf,
  isInternalDimension,
  resolveCombination,
  variantCombinations,
  type VariantCombination,
} from '../../app/utils/variant-tree';
import {
  oneDimensionTree,
  partialGridTree,
  pumpCombinations,
  sharedValueTree,
  switchCombinations,
  twoDimensionTree,
} from '../fixtures/variant-trees';

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

  it('ignores a value on a node without a dimension', () => {
    const combos = variantCombinations([{ alias: 'a', value: 'x' }]);

    expect(combos[0]!.selection).toEqual({});
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

describe('combinationExists', () => {
  const grid = variantCombinations(partialGridTree);

  it('is true for a value that forms a variant with the other choices', () => {
    expect(
      combinationExists(
        grid,
        { Effekt: '0,66 kw', Spänning: '150 v' },
        'Spänning',
        '150 v',
      ),
    ).toBe(true);
  });

  it('is false for a value that exists only with another choice elsewhere', () => {
    expect(
      combinationExists(
        grid,
        { Effekt: '0,66 kw', Spänning: '150 v' },
        'Spänning',
        '400 v',
      ),
    ).toBe(false);
  });

  it('ignores the current value of the dimension being picked', () => {
    expect(
      combinationExists(
        grid,
        { Effekt: '0,37 kw', Spänning: '400 v' },
        'Spänning',
        '150 v',
      ),
    ).toBe(true);
    expect(
      combinationExists(
        grid,
        { Effekt: '0,37 kw', Spänning: '400 v' },
        'Effekt',
        '0,66 kw',
      ),
    ).toBe(false);
  });

  it('is true for any value while the other dimensions are unset', () => {
    expect(combinationExists(grid, {}, 'Spänning', '400 v')).toBe(true);
  });

  it('is false for a value no variant has', () => {
    expect(combinationExists(grid, {}, 'Spänning', '230 v')).toBe(false);
  });
});

describe('changeGroups', () => {
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
  // A × poles × IP, five of the twelve combinations.
  const switches = [
    combo('25-3-65', { A: '25', P: '3P', IP: 'IP65' }),
    combo('25-4-65', { A: '25', P: '4P', IP: 'IP65' }),
    combo('40-4-66', { A: '40', P: '4P', IP: 'IP66' }),
    combo('40-3-65', { A: '40', P: '3P', IP: 'IP65' }),
    combo('63-4-66', { A: '63', P: '4P', IP: 'IP66' }),
    combo('40-3-66', { A: '40', P: '3P', IP: 'IP66' }),
  ];
  const current = { A: '25', P: '3P', IP: 'IP65' };
  const shape = (groups: ReturnType<typeof changeGroups>) =>
    groups.map((g) => [g.dimensions, g.combinations.map((c) => c.alias)]);

  it('groups the variants by which other dimensions change, fewest first', () => {
    const groups = changeGroups(
      switchCombinations,
      { Poler: '3P', Kapsling: 'IP65', Märkström: '25 A' },
      'Märkström',
    );
    expect(shape(groups)).toEqual([
      [['Poler'], ['40 A-4P-IP65']],
      [['Kapsling'], ['40 A-3P-IP66']],
      [
        ['Poler', 'Kapsling'],
        ['40 A-4P-IP66', '63 A-4P-IP66'],
      ],
    ]);
  });

  it('leaves out a value that is also reachable directly', () => {
    const groups = changeGroups(
      pumpCombinations,
      { Effekt: '0,37 kW', Spänning: '230 V' },
      'Effekt',
    );
    expect(shape(groups)).toEqual([[['Spänning'], ['0,75 kW-400 V']]]);
  });

  it('leaves out variants that keep the other choices', () => {
    const aliases = changeGroups(switches, current, 'A').flatMap((g) =>
      g.combinations.map((c) => c.alias),
    );
    expect(aliases).not.toContain('40-3-65');
    expect(aliases).not.toContain('25-3-65');
  });

  it("leaves out variants that keep the sheet's own value", () => {
    const aliases = changeGroups(switches, current, 'A').flatMap((g) =>
      g.combinations.map((c) => c.alias),
    );
    expect(aliases).not.toContain('25-4-65');
  });

  it('leaves out a variant that lacks the sheet dimension', () => {
    const ragged = [combo('a', { A: '25', P: '3P' }), combo('b', { P: '4P' })];
    expect(changeGroups(ragged, { A: '25', P: '3P' }, 'A')).toEqual([]);
  });

  it('counts no dimension the buyer has not chosen as changed', () => {
    const grid = [
      combo('a', { A: '25', P: '3P', IP: 'IP65' }),
      combo('b', { A: '40', P: '4P', IP: 'IP66' }),
    ];
    expect(shape(changeGroups(grid, { A: '25', P: '3P' }, 'A'))).toEqual([
      [['P'], ['b']],
    ]);
  });

  it('puts fewer changes first whatever the payload order', () => {
    const grid = [
      combo('own', { A: '25', P: '3P', IP: 'IP65' }),
      combo('two', { A: '63', P: '4P', IP: 'IP66' }),
      combo('one', { A: '40', P: '4P', IP: 'IP65' }),
    ];
    expect(shape(changeGroups(grid, current, 'A'))).toEqual([
      [['P'], ['one']],
      [['P', 'IP'], ['two']],
    ]);
  });

  it('orders same-size groups by the first dimension they differ on', () => {
    const own = { S: '1', P: 'p1', Q: 'q1', R: 'r1' };
    const grid = [
      combo('own', own),
      combo('pr', { S: '2', P: 'p2', Q: 'q1', R: 'r2' }),
      combo('pq', { S: '3', P: 'p2', Q: 'q2', R: 'r1' }),
    ];
    expect(shape(changeGroups(grid, own, 'S'))).toEqual([
      [['P', 'Q'], ['pq']],
      [['P', 'R'], ['pr']],
    ]);
  });

  it('orders groups of the same size by dimension order', () => {
    const grid = [
      combo('a', { A: '25', P: '3P', IP: 'IP65' }),
      combo('b', { A: '40', P: '3P', IP: 'IP66' }),
      combo('c', { A: '63', P: '4P', IP: 'IP65' }),
    ];
    expect(shape(changeGroups(grid, current, 'A'))).toEqual([
      [['P'], ['c']],
      [['IP'], ['b']],
    ]);
  });

  it('gives one group on two dimensions, a value once per variant', () => {
    expect(
      shape(
        changeGroups(
          variantCombinations(sharedValueTree),
          { Gänga: 'm10', Längd: '40 mm' },
          'Längd',
        ),
      ),
    ).toEqual([
      [
        ['Gänga'],
        [
          'sexkantskruv-m6x30-din-933-elforzinkad',
          'sexkantskruv-m8x30-din-933-elforzinkad',
        ],
      ],
    ]);
  });
});

describe('dimensionsOf', () => {
  it('keeps the first label a value comes with', () => {
    const combo = (alias: string, label: string): VariantCombination => ({
      alias,
      productId: null,
      selection: { D: 'x' },
      labels: { D: label },
      stock: null,
    });

    expect(dimensionsOf([combo('a', 'X1'), combo('b', 'X2')])).toEqual([
      { dimensionName: 'D', values: [{ value: 'x', label: 'X1' }] },
    ]);
  });

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

describe('isInternalDimension', () => {
  it.each(['DefaultProduct', 'DefaultSku'])('is true for %s', (name) => {
    expect(isInternalDimension(name)).toBe(true);
  });

  it.each(['Färg', 'Variant', 'defaultproduct', ''])(
    'is false for %j',
    (name) => {
      expect(isInternalDimension(name)).toBe(false);
    },
  );
});
