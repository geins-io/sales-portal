import { describe, it, expect } from 'vitest';
import type { SkuType } from '@geins/types';
import type { StockType } from '#shared/types/commerce';
import {
  VARIANT_SEARCH_FROM,
  changeHeading,
  combinationLabel,
  combinationRows,
  dimensionSelectGroups,
  filterRows,
  matchingHeading,
  showsSearch,
  skuRows,
  visibleDimensions,
  type VariantRow,
  type VariantRowFallback,
} from '../../app/utils/variant-rows';
import {
  resolveCombination,
  variantCombinations,
  type VariantCombination,
} from '../../app/utils/variant-tree';
import {
  pumpCombinations,
  switchCombinations,
  twoDimensionTree,
} from '../fixtures/variant-trees';

const stock = (totalStock: number): StockType => ({
  inStock: totalStock,
  oversellable: 0,
  totalStock,
  static: 0,
});

const fallback: VariantRowFallback = {
  productName: 'Sexkantskruv',
  articleNumber: 'PARENT-1',
  priceIncVatFormatted: '125 kr',
  priceExVatFormatted: '100 kr',
  image: { fileName: 'parent.jpg', url: null },
};

const combo = (
  alias: string,
  selection: Record<string, string>,
  labels: Record<string, string> = selection,
): VariantCombination => ({
  alias,
  productId: null,
  selection,
  labels,
  stock: null,
});

describe('combinationLabel', () => {
  it('joins the labels top dimension first', () => {
    const [m10] = variantCombinations(twoDimensionTree);
    expect(combinationLabel(m10!)).toBe('M10, 50 mm');
  });

  it('keeps the internal dimension when it is the only one', () => {
    expect(
      combinationLabel(
        combo('a', { DefaultProduct: 'svart' }, { DefaultProduct: 'Svart' }),
      ),
    ).toBe('Svart');
  });

  it("leaves out Geins's internal dimensions", () => {
    expect(
      combinationLabel(
        combo('a', { DefaultProduct: 'x', Färg: 'Svart', DefaultSku: 'y' }),
      ),
    ).toBe('Svart');
  });
});

describe('combinationRows', () => {
  const combinations = variantCombinations(twoDimensionTree);
  const current = { Gänga: 'm12', Längd: '60 mm' };

  it('lists every variant once, in payload order, marking the current one', () => {
    const rows = combinationRows(combinations, current, {}, fallback, true);
    expect(rows.map((r) => r.key)).toEqual(combinations.map((c) => c.alias));
    expect(rows.map((r) => r.label)).toEqual([
      'M10, 50 mm',
      'M12, 60 mm',
      'M8, 40 mm',
    ]);
    expect(rows.map((r) => r.selected)).toEqual([false, true, false]);
  });

  it('reads no meta at all as every variant falling back to the product', () => {
    const rows = combinationRows(
      combinations,
      current,
      undefined,
      fallback,
      true,
    );
    expect(rows[0]).toMatchObject({ name: 'Sexkantskruv', price: '125 kr' });
  });

  it('marks no row while the current choice is partial', () => {
    const rows = combinationRows(
      combinations,
      { Gänga: 'm12' },
      {},
      fallback,
      true,
    );
    expect(rows.some((r) => r.selected)).toBe(false);
  });

  it("takes each variant's own name, article number, image and price in the chosen VAT mode", () => {
    const alias = combinations[0]!.alias;
    const meta = {
      [alias]: {
        name: 'Skruv M10',
        articleNumber: 'M10-50',
        image: { fileName: 'm10.jpg', url: 'https://x/m10.jpg' },
        priceIncVatFormatted: '250 kr',
        priceExVatFormatted: '200 kr',
      },
    };
    const inc = combinationRows(combinations, current, meta, fallback, true);
    expect(inc[0]).toMatchObject({
      name: 'Skruv M10',
      articleNumber: 'M10-50',
      image: { fileName: 'm10.jpg', url: 'https://x/m10.jpg' },
      price: '250 kr',
    });
    const ex = combinationRows(combinations, current, meta, fallback, false);
    expect(ex[0]!.price).toBe('200 kr');
  });

  it("falls back to the product's own name, article number and price, and leaves the image unknown", () => {
    const rows = combinationRows(combinations, current, {}, fallback, false);
    expect(rows[1]).toMatchObject({
      name: 'Sexkantskruv',
      articleNumber: 'PARENT-1',
      price: '100 kr',
      image: undefined,
    });
  });

  it('passes on a variant known to have no image as null', () => {
    const alias = combinations[2]!.alias;
    const rows = combinationRows(
      combinations,
      current,
      { [alias]: { image: null } },
      fallback,
      true,
    );
    expect(rows[2]!.image).toBeNull();
  });

  it('hands a variant without a price of its own the product price, source by source', () => {
    const alias = combinations[0]!.alias;
    const rows = combinationRows(
      combinations,
      current,
      { [alias]: { priceExVatFormatted: '200 kr' } },
      fallback,
      true,
    );
    expect(rows[0]!.price).toBe('125 kr');
  });

  it('has no price when neither the variant nor the product has one', () => {
    const rows = combinationRows(
      combinations,
      current,
      {},
      { ...fallback, priceIncVatFormatted: null, priceExVatFormatted: null },
      true,
    );
    expect(rows.every((r) => r.price === null)).toBe(true);
  });

  it("carries each variant's stock, out of stock included", () => {
    const rows = combinationRows(combinations, current, {}, fallback, true);
    expect(rows[2]!.stock?.totalStock).toBe(0);
    expect(rows[0]!.stock?.totalStock).toBe(7);
  });
});

describe('skuRows', () => {
  const skus: SkuType[] = [
    { skuId: 11, name: 'Rulle 50 m', articleNumber: 'K-50', stock: stock(3) },
    { skuId: 12, name: '', articleNumber: 'K-100', stock: stock(0) },
  ];

  it("gives each SKU its name, article number, stock, the product's price and image", () => {
    const rows = skuRows(skus, 12, fallback, false);
    expect(rows).toEqual([
      {
        key: '11',
        label: 'Rulle 50 m',
        name: 'Sexkantskruv',
        articleNumber: 'K-50',
        stock: stock(3),
        price: '100 kr',
        image: fallback.image,
        selected: false,
      },
      {
        key: '12',
        label: 'K-100',
        name: 'Sexkantskruv',
        articleNumber: 'K-100',
        stock: stock(0),
        price: '100 kr',
        image: fallback.image,
        selected: true,
      },
    ]);
  });

  it('marks no SKU before a pick and shows the price including VAT when chosen', () => {
    const rows = skuRows(skus, null, fallback, true);
    expect(rows.some((r) => r.selected)).toBe(false);
    expect(rows[0]!.price).toBe('125 kr');
  });

  it('leaves the label empty and the stock null when the SKU has neither', () => {
    const [row] = skuRows([{ skuId: 1 }], null, fallback, true);
    expect(row).toMatchObject({ label: '', articleNumber: null, stock: null });
  });
});

describe('search', () => {
  const row = (label: string, articleNumber: string | null): VariantRow => ({
    key: label,
    label,
    name: '',
    articleNumber,
    stock: null,
    price: null,
    image: null,
    selected: false,
  });
  const rows = [row('Svart, M', 'ART-2001-SV-M'), row('Marinblå, S', null)];

  it('shows from 8 rows', () => {
    expect(VARIANT_SEARCH_FROM).toBe(8);
    expect(showsSearch(Array.from({ length: 7 }, () => rows[0]!))).toBe(false);
    expect(showsSearch(Array.from({ length: 8 }, () => rows[0]!))).toBe(true);
  });

  it('filters on the values and the article number, ignoring case and spaces around', () => {
    expect(filterRows(rows, '  MARINBLÅ ').map((r) => r.label)).toEqual([
      'Marinblå, S',
    ]);
    expect(filterRows(rows, 'sv-m').map((r) => r.label)).toEqual(['Svart, M']);
    expect(filterRows(rows, 'xyz')).toEqual([]);
  });

  it('does not match a query across the values and the article number', () => {
    expect(filterRows(rows, 'm art')).toEqual([]);
  });

  it('keeps every row for an empty query', () => {
    expect(filterRows(rows, '   ')).toBe(rows);
  });
});

describe('visibleDimensions', () => {
  it('drops an internal dimension with a single value and keeps named ones', () => {
    const dims = visibleDimensions([
      combo('a', { DefaultProduct: 'x', Färg: 'Svart' }),
      combo('b', { DefaultProduct: 'x', Färg: 'Röd' }),
    ]);
    expect(dims.map((d) => d.dimensionName)).toEqual(['Färg']);
  });

  it('keeps an internal dimension that offers a choice', () => {
    const dims = visibleDimensions([
      combo('a', { DefaultProduct: 'x' }),
      combo('b', { DefaultProduct: 'y' }),
    ]);
    expect(dims.map((d) => d.dimensionName)).toEqual(['DefaultProduct']);
  });
});

describe('dimensionSelectGroups', () => {
  it('lists the values that keep the other choices first, then those that change one', () => {
    const groups = dimensionSelectGroups(
      pumpCombinations,
      { Effekt: '0,37 kW', Spänning: '230 V' },
      'Effekt',
    );
    expect(groups).toEqual([
      {
        key: 'matching',
        kind: 'matching',
        dimensions: [],
        values: [
          { value: '0,37 kW', label: '0,37 kW' },
          { value: '1,5 kW', label: '1,5 kW' },
        ],
      },
      {
        key: 'Spänning',
        kind: 'change',
        dimensions: ['Spänning'],
        values: [{ value: '0,75 kW', label: '0,75 kW' }],
      },
    ]);
  });

  it('lists each value once, under what its pick changes, fewest changes first', () => {
    const groups = dimensionSelectGroups(
      switchCombinations,
      { Poler: '3P', Kapsling: 'IP65', Märkström: '16 A' },
      'Märkström',
    );
    // 40 A ties between 4P·IP65 and 3P·IP66; the pick keeps Poler.
    expect(groups.map((g) => [g.key, g.values.map((v) => v.value)])).toEqual([
      ['matching', ['16 A', '25 A']],
      ['Kapsling', ['40 A']],
      ['Poler-Kapsling', ['63 A']],
    ]);
  });

  it('names exactly what each pick changes, for every variant, dimension and value', () => {
    const lies: string[] = [];
    for (const from of switchCombinations) {
      const current = from.selection;
      for (const dimension of Object.keys(current)) {
        for (const group of dimensionSelectGroups(
          switchCombinations,
          current,
          dimension,
        )) {
          for (const { value } of group.values) {
            const target = resolveCombination(
              switchCombinations,
              current,
              dimension,
              value,
            )!;
            const changed = Object.keys(current).filter(
              (d) => d !== dimension && target.selection[d] !== current[d],
            );
            if (JSON.stringify(changed) !== JSON.stringify(group.dimensions)) {
              lies.push(
                `${from.alias}: ${dimension} ${value} says ${JSON.stringify(group.dimensions)}, changes ${JSON.stringify(changed)}`,
              );
            }
          }
        }
      }
    }
    expect(lies).toEqual([]);
  });

  it('orders the change groups fewest first, then by dimension, whatever the value order', () => {
    const current = { X: 'x1', Y: 'y1', Z: 'z1' };
    const fewest = dimensionSelectGroups(
      [
        combo('now', { X: 'x1', Y: 'y1', Z: 'z1' }),
        combo('two', { X: 'x2', Y: 'y2', Z: 'z2' }),
        combo('one', { X: 'x1', Y: 'y2', Z: 'z3' }),
      ],
      current,
      'Z',
    );
    expect(fewest.map((g) => g.key)).toEqual(['matching', 'Y', 'X-Y']);
    const byDimension = dimensionSelectGroups(
      [
        combo('now', { X: 'x1', Y: 'y1', Z: 'z1' }),
        combo('y', { X: 'x1', Y: 'y2', Z: 'z2' }),
        combo('x', { X: 'x2', Y: 'y1', Z: 'z3' }),
      ],
      current,
      'Z',
    );
    expect(byDimension.map((g) => g.key)).toEqual(['matching', 'X', 'Y']);
    const laterDimension = dimensionSelectGroups(
      [
        combo('now', { A: 'a1', B: 'b1', C: 'c1', D: 'd1' }),
        combo('ac', { A: 'a2', B: 'b1', C: 'c2', D: 'd2' }),
        combo('ab', { A: 'a2', B: 'b2', C: 'c1', D: 'd3' }),
      ],
      { A: 'a1', B: 'b1', C: 'c1', D: 'd1' },
      'D',
    );
    expect(laterDimension.map((g) => g.key)).toEqual([
      'matching',
      'A-B',
      'A-C',
    ]);
  });

  it('groups a two-change tie under the later dimensions', () => {
    const four = [
      combo('now', { A: 'a1', B: 'b1', C: 'c1', D: 'd1' }),
      combo('ab', { A: 'a2', B: 'b2', C: 'c1', D: 'd2' }),
      combo('ac', { A: 'a2', B: 'b1', C: 'c2', D: 'd2' }),
      combo('bc', { A: 'a1', B: 'b2', C: 'c2', D: 'd2' }),
    ];
    const groups = dimensionSelectGroups(
      four,
      { A: 'a1', B: 'b1', C: 'c1', D: 'd1' },
      'D',
    );
    expect(groups.map((g) => [g.key, g.values.map((v) => v.value)])).toEqual([
      ['matching', ['d1']],
      ['B-C', ['d2']],
    ]);
  });

  it('counts a dimension the current choice lacks as changed', () => {
    const groups = dimensionSelectGroups(
      switchCombinations,
      { Poler: '3P', Märkström: '16 A' },
      'Märkström',
    );
    expect(groups.at(-1)).toMatchObject({
      key: 'Poler-Kapsling',
      dimensions: ['Poler', 'Kapsling'],
      values: [{ value: '63 A', label: '63 A' }],
    });
  });

  it('reaches every variant from every other through the selects', () => {
    const next = (from: VariantCombination) =>
      Object.keys(from.selection).flatMap((dimension) =>
        dimensionSelectGroups(switchCombinations, from.selection, dimension)
          .flatMap((g) => g.values)
          .map(({ value }) =>
            resolveCombination(
              switchCombinations,
              from.selection,
              dimension,
              value,
            )!,
          ),
      );
    let most = 0;
    for (const start of switchCombinations) {
      const picks = new Map([[start.alias, 0]]);
      const queue = [start];
      while (queue.length) {
        const from = queue.shift()!;
        for (const to of next(from)) {
          if (picks.has(to.alias)) continue;
          picks.set(to.alias, picks.get(from.alias)! + 1);
          queue.push(to);
        }
      }
      expect(picks.size, `from ${start.alias}`).toBe(switchCombinations.length);
      most = Math.max(most, ...picks.values());
    }
    // The most picks one variant takes to reach another.
    expect(most).toBe(3);
  });

  it('has one group when every value keeps the other choices', () => {
    const groups = dimensionSelectGroups(
      pumpCombinations,
      { Effekt: '0,37 kW', Spänning: '230 V' },
      'Spänning',
    );
    expect(groups.map((g) => g.key)).toEqual(['matching']);
  });

  it('lists values by their label, in dimension order', () => {
    const groups = dimensionSelectGroups(
      variantCombinations(twoDimensionTree),
      { Gänga: 'm12', Längd: '60 mm' },
      'Gänga',
    );
    expect(groups[0]!.values).toEqual([{ value: 'm12', label: 'M12' }]);
    expect(groups.flatMap((g) => g.values.map((v) => v.label))).toEqual([
      'M12',
      'M10',
      'M8',
    ]);
  });

  it('has no matching group when the current choice is no variant', () => {
    const groups = dimensionSelectGroups(
      pumpCombinations,
      { Effekt: '0,37 kW', Spänning: '110 V' },
      'Effekt',
    );
    expect(groups.map((g) => g.kind)).toEqual(['change']);
  });

  it('has no groups for a dimension the variants do not have', () => {
    expect(dimensionSelectGroups(pumpCombinations, {}, 'Färg')).toEqual([]);
  });
});

describe('matchingHeading', () => {
  const dims = (combos: VariantCombination[]) => visibleDimensions(combos);

  it('names the one other dimension and its value', () => {
    expect(
      matchingHeading(
        dims(pumpCombinations),
        { Effekt: '0,37 kW', Spänning: '230 V' },
        'Effekt',
        'en',
      ),
    ).toEqual({
      key: 'product.variant_group_matching_named',
      params: { dimension: 'Spänning', value: '230 V' },
    });
  });

  it('lists several other dimensions with their values', () => {
    expect(
      matchingHeading(
        dims(switchCombinations),
        { Poler: '3P', Kapsling: 'IP65', Märkström: '16 A' },
        'Märkström',
        'en',
      ),
    ).toEqual({
      key: 'product.variant_group_matching_with',
      params: { value: 'Poler: 3P and Kapsling: IP65' },
    });
  });

  it('names the other value by its own label, wherever it sits in the dimension', () => {
    const combos = variantCombinations(twoDimensionTree);
    expect(
      matchingHeading(
        dims(combos),
        { Gänga: 'm8', Längd: '40 mm' },
        'Längd',
        'en',
      ),
    ).toEqual({
      key: 'product.variant_group_matching_named',
      params: { dimension: 'Gänga', value: 'M8' },
    });
  });

  it('names a value the dimension does not list by the value itself', () => {
    expect(
      matchingHeading(
        dims(pumpCombinations),
        { Effekt: '0,37 kW', Spänning: '110 V' },
        'Effekt',
        'en',
      ),
    ).toEqual({
      key: 'product.variant_group_matching_named',
      params: { dimension: 'Spänning', value: '110 V' },
    });
  });

  it('stays neutral while another dimension has no value', () => {
    expect(
      matchingHeading(
        dims(switchCombinations),
        { Poler: '3P', Märkström: '16 A' },
        'Märkström',
        'en',
      ),
    ).toEqual({ key: 'product.variant_group_matching' });
    expect(matchingHeading(dims(pumpCombinations), {}, 'Effekt', 'en')).toEqual(
      { key: 'product.variant_group_matching' },
    );
  });

  it('stays neutral with no other dimension', () => {
    expect(
      matchingHeading(
        dims([combo('a', { Färg: 'Svart' })]),
        { Färg: 'Svart' },
        'Färg',
        'en',
      ),
    ).toEqual({ key: 'product.variant_group_matching' });
  });

  it('leaves a nameless other dimension out and names its label only', () => {
    const combos = [
      combo(
        'a',
        { Färg: 'svart', DefaultProduct: 'x' },
        {
          Färg: 'Svart',
          DefaultProduct: 'X',
        },
      ),
      combo(
        'b',
        { Färg: 'röd', DefaultProduct: 'y' },
        {
          Färg: 'Röd',
          DefaultProduct: 'Y',
        },
      ),
    ];
    expect(
      matchingHeading(
        dims(combos),
        { Färg: 'svart', DefaultProduct: 'x' },
        'Färg',
        'en',
      ),
    ).toEqual({
      key: 'product.variant_group_matching_with',
      params: { value: 'X' },
    });
  });

  it('stays neutral when one of several other dimensions has no name', () => {
    const combos = [
      combo('a', { Färg: 'svart', Storlek: 'm', DefaultProduct: 'x' }),
      combo('b', { Färg: 'röd', Storlek: 's', DefaultProduct: 'y' }),
    ];
    expect(
      matchingHeading(
        dims(combos),
        { Färg: 'svart', Storlek: 'm', DefaultProduct: 'x' },
        'Färg',
        'en',
      ),
    ).toEqual({ key: 'product.variant_group_matching' });
  });
});

describe('changeHeading', () => {
  it('names the dimensions a value changes', () => {
    expect(changeHeading(['Poler', 'Kapsling'], 'en')).toEqual({
      key: 'product.variant_group_more_changes',
      params: { dimension: 'Poler and Kapsling' },
    });
    expect(changeHeading(['Diameter'], 'sv')).toEqual({
      key: 'product.variant_group_more_changes',
      params: { dimension: 'Diameter' },
    });
  });

  it('says only "More options" when a changed dimension has no name', () => {
    expect(changeHeading(['DefaultProduct'], 'en')).toEqual({
      key: 'product.variant_group_more',
    });
    expect(changeHeading([' '], 'en')).toEqual({
      key: 'product.variant_group_more',
    });
    expect(changeHeading(['Poler', 'DefaultProduct'], 'en')).toEqual({
      key: 'product.variant_group_more',
    });
  });
});
