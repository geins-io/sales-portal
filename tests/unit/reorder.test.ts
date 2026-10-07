import { describe, it, expect } from 'vitest';
import { reorderLines } from '../../app/utils/reorder';
import { resolveProductPageType } from '../../app/utils/product-page-type';

const SUMMARY = { summary: [{ label: 'Adapter', value: 'S45' }] };

const plain = { skuId: 10, quantity: 2, product: { configurable: false } };
const configurable = {
  skuId: 20,
  quantity: 1,
  product: { productId: 1359, configurable: true as const },
};
const configured = { ...configurable, configuration: SUMMARY };

function pageTypes(configuratorOn: boolean, signedIn: boolean) {
  return (product: { configurable?: boolean } | null | undefined) =>
    resolveProductPageType(
      product,
      { enabled: configuratorOn },
      { authenticated: signedIn },
    );
}

const SIGNED_IN = pageTypes(true, true);

describe('reorderLines', () => {
  it('adds an ordinary row at its quantity', () => {
    expect(reorderLines([plain], SIGNED_IN)).toEqual({
      lines: [{ skuId: 10, quantity: 2 }],
      skipped: 0,
    });
  });

  it('leaves out and counts a row whose product gets the configurator page', () => {
    expect(reorderLines([plain, configurable, configured], SIGNED_IN)).toEqual({
      lines: [{ skuId: 10, quantity: 2 }],
      skipped: 2,
    });
  });

  it('leaves out and counts a configurable row for a guest, never a plain add', () => {
    expect(
      reorderLines([plain, configurable, configured], pageTypes(true, false)),
    ).toEqual({
      lines: [{ skuId: 10, quantity: 2 }],
      skipped: 2,
    });
  });

  it('leaves out a configured row when the configurator is off', () => {
    expect(reorderLines([configured], pageTypes(false, true))).toEqual({
      lines: [],
      skipped: 1,
    });
  });

  it('adds a configurable row without a configuration when the configurator is off, as add-all does', () => {
    expect(reorderLines([configurable], pageTypes(false, true))).toEqual({
      lines: [{ skuId: 20, quantity: 1 }],
      skipped: 0,
    });
  });

  it('counts a row with an empty summary as configured', () => {
    expect(
      reorderLines([{ ...plain, configuration: { summary: [] } }], SIGNED_IN),
    ).toEqual({ lines: [], skipped: 1 });
  });

  it('adds a row without a quantity once', () => {
    expect(
      reorderLines([{ skuId: 10, quantity: null }], SIGNED_IN).lines,
    ).toEqual([{ skuId: 10, quantity: 1 }]);
  });

  it('drops a row without a SKU or a null row without counting it', () => {
    expect(
      reorderLines(
        [null, { skuId: null, quantity: 1 }, { quantity: 1 }],
        SIGNED_IN,
      ),
    ).toEqual({ lines: [], skipped: 0 });
  });
});
