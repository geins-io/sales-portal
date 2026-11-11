import { describe, it, expect } from 'vitest';
import { quickAddChoice } from '../../app/utils/quote-quick-add';

const hit = (skus: unknown[], configurable?: boolean) => ({
  skus: skus as { skuId?: number | null }[],
  ...(configurable === undefined ? {} : { configurable }),
});

describe('quickAddChoice', () => {
  it('adds the only SKU of a plain product', () => {
    expect(quickAddChoice(hit([{ skuId: 1163 }]))).toEqual({ skuId: 1163 });
  });

  it('adds nothing for a configurable product: it is configured first', () => {
    expect(quickAddChoice(hit([{ skuId: 1163 }], true))).toEqual({
      blocked: 'configurable',
    });
  });

  it('adds nothing for a product with several variants: the buyer picks one', () => {
    expect(quickAddChoice(hit([{ skuId: 1 }, { skuId: 2 }]))).toEqual({
      blocked: 'variants',
    });
  });

  it('adds a plain product marked not configurable', () => {
    expect(quickAddChoice(hit([{ skuId: 7 }], false))).toEqual({ skuId: 7 });
  });

  it.each([[[]], [[{}]], [[{ skuId: null }]]])(
    'adds nothing without a SKU (%j)',
    (skus) => {
      expect(quickAddChoice(hit(skus))).toEqual({ blocked: 'no-sku' });
    },
  );
});
