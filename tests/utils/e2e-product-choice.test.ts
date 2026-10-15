import { describe, it, expect } from 'vitest';
import {
  FIXTURE_SEED_PRODUCT_IDS,
  purchaseCandidates,
  unitsAvailable,
  type StockedCandidate,
} from '../e2e/product-choice';

/**
 * The part of `discoverPurchasableProduct` that decides which product a test
 * buys. The PDP probe stays in the helper; this is the choice it probes in.
 */

function row(
  alias: string,
  stock: StockedCandidate['stock'],
  productId = 2000,
): StockedCandidate {
  return { alias, productId, stock };
}

const limited = (totalStock: number) => ({
  totalStock,
  oversellable: 0,
  static: 0,
});

describe('unitsAvailable', () => {
  it('is the total stock when the stock is limited', () => {
    expect(unitsAvailable(limited(7))).toBe(7);
  });

  it('is unlimited when the stock is oversellable or static, as on the PDP', () => {
    expect(unitsAvailable({ totalStock: 0, oversellable: 1, static: 0 })).toBe(
      Number.POSITIVE_INFINITY,
    );
    expect(unitsAvailable({ totalStock: 0, oversellable: 0, static: 1 })).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  it('is unlimited when no stock was sent, as on the PDP', () => {
    expect(unitsAvailable(undefined)).toBe(Number.POSITIVE_INFINITY);
    expect(unitsAvailable(null)).toBe(Number.POSITIVE_INFINITY);
  });

  it('is zero for a limited stock without a total', () => {
    expect(unitsAvailable({ oversellable: 0, static: 0 })).toBe(0);
  });
});

describe('purchaseCandidates', () => {
  it('skips a candidate whose stock is below the quantity', () => {
    const result = purchaseCandidates(
      [row('two-left', limited(2), 1), row('three-left', limited(3), 2)],
      3,
    );
    expect(result.map((c) => c.alias)).toEqual(['three-left']);
  });

  it('puts the highest stock first, unlimited above any number', () => {
    const result = purchaseCandidates(
      [
        row('ten', limited(10), 1),
        row('eight-hundred', limited(800), 2),
        row('on-demand', { totalStock: 0, oversellable: 0, static: 5 }, 3),
        row('fifty', limited(50), 4),
      ],
      1,
    );
    expect(result.map((c) => c.alias)).toEqual([
      'on-demand',
      'eight-hundred',
      'fifty',
      'ten',
    ]);
  });

  it('breaks a stock tie by alias, so the order is the same every call', () => {
    const result = purchaseCandidates(
      [row('b', limited(5), 1), row('a', limited(5), 2)],
      1,
    );
    expect(result.map((c) => c.alias)).toEqual(['a', 'b']);
  });

  it('never chooses the fixture seeds, whatever their stock', () => {
    expect(FIXTURE_SEED_PRODUCT_IDS).toEqual(['1101', '1102']);
    const result = purchaseCandidates(
      [
        row('arbetsbord-pro', limited(900), 1101),
        row('skapsektion-pro', limited(900), 1102),
        row('ordinary', limited(4), 1103),
      ],
      1,
    );
    expect(result.map((c) => c.alias)).toEqual(['ordinary']);
  });

  it('matches a seed whose id arrives as a string', () => {
    const result = purchaseCandidates(
      [
        { alias: 'arbetsbord-pro', productId: '1101', stock: limited(9) },
        row('ordinary', limited(4), 1103),
      ],
      1,
    );
    expect(result.map((c) => c.alias)).toEqual(['ordinary']);
  });

  it('keeps a candidate whose stock equals the quantity', () => {
    const result = purchaseCandidates([row('exact', limited(3))], 3);
    expect(result.map((c) => c.alias)).toEqual(['exact']);
  });

  it('fails with the quantity and the best stock found when none has enough', () => {
    expect(() =>
      purchaseCandidates(
        [
          row('one', limited(1), 1),
          row('two', limited(2), 2),
          row('seed', limited(900), 1101),
        ],
        3,
      ),
    ).toThrow(
      'No product has stock for 3 units: the best is "two" with 2 ' +
        '(read 3 candidates, the fixture seeds left out).',
    );
  });

  it('fails naming no stock at all when every candidate is a seed', () => {
    expect(() =>
      purchaseCandidates([row('seed', limited(900), 1101)], 1),
    ).toThrow(
      'No product has stock for 1 unit: no candidate is left once the ' +
        'fixture seeds are out (read 1 candidate).',
    );
  });

  it('does not change the list it was given', () => {
    const rows = [row('b', limited(1), 1), row('a', limited(9), 2)];
    purchaseCandidates(rows, 1);
    expect(rows.map((c) => c.alias)).toEqual(['b', 'a']);
  });
});
