import { describe, it, expect } from 'vitest';
import { reorderLines } from '../../app/utils/reorder';

const SUMMARY = { summary: [{ label: 'Adapter', value: 'S45' }] };

const plain = { skuId: 10, quantity: 2, product: { configurable: false } };
const configurable = {
  skuId: 20,
  quantity: 1,
  product: { productId: 1359, configurable: true as const },
};
const configured = { ...configurable, configuration: SUMMARY };

describe('reorderLines', () => {
  it('adds an ordinary row at its quantity', () => {
    expect(reorderLines([plain], true)).toEqual({
      lines: [{ skuId: 10, quantity: 2 }],
      skipped: 0,
    });
  });

  it('leaves out and counts a row whose product gets the configurator page', () => {
    expect(reorderLines([plain, configurable, configured], true)).toEqual({
      lines: [{ skuId: 10, quantity: 2 }],
      skipped: 2,
    });
  });

  it('leaves out a configured row for a buyer the access rule refuses', () => {
    expect(reorderLines([configured], false)).toEqual({
      lines: [],
      skipped: 1,
    });
  });

  it('adds a configurable row without a configuration for a buyer the access rule refuses, as add-all does', () => {
    expect(reorderLines([configurable], false)).toEqual({
      lines: [{ skuId: 20, quantity: 1 }],
      skipped: 0,
    });
  });

  it('counts a row with an empty summary as configured', () => {
    expect(
      reorderLines([{ ...plain, configuration: { summary: [] } }], true),
    ).toEqual({ lines: [], skipped: 1 });
  });

  it('adds a row without a quantity once', () => {
    expect(reorderLines([{ skuId: 10, quantity: null }], true).lines).toEqual([
      { skuId: 10, quantity: 1 },
    ]);
  });

  it('drops a row without a SKU or a null row without counting it', () => {
    expect(
      reorderLines([null, { skuId: null, quantity: 1 }, { quantity: 1 }], true),
    ).toEqual({ lines: [], skipped: 0 });
  });
});
