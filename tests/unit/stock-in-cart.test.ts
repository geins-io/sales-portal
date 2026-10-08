import { describe, it, expect } from 'vitest';
import type { StockType } from '../../shared/types/commerce';
import {
  quantityInCart,
  stockBlock,
  stockLeft,
} from '../../app/utils/stock-in-cart';

function stock(overrides: Partial<StockType> = {}): StockType {
  return {
    inStock: 1,
    oversellable: 0,
    totalStock: 1,
    static: 0,
    ...overrides,
  };
}

describe('quantityInCart', () => {
  const items = [
    { id: 'plain', skuId: 1788, quantity: 2 },
    { id: 'configured', skuId: 1788, quantity: 1 },
    { id: 'other', skuId: 1474, quantity: 5 },
  ];

  it('sums every line of the SKU, configured or not', () => {
    expect(quantityInCart(items, 1788)).toBe(3);
  });

  it('leaves out the line it is told to', () => {
    expect(quantityInCart(items, 1788, 'configured')).toBe(2);
  });

  it('counts a line without an id when no line is left out', () => {
    expect(quantityInCart([{ skuId: 1788, quantity: 1 }], 1788)).toBe(1);
    expect(quantityInCart([{ skuId: 1788, quantity: 1 }], 1788, null)).toBe(1);
  });

  it('matches a SKU id the cart sends as a string', () => {
    expect(
      quantityInCart([{ id: 'a', skuId: '1788', quantity: 4 }], 1788),
    ).toBe(4);
  });

  it('is nothing without a SKU or a cart', () => {
    expect(quantityInCart(items, null)).toBe(0);
    expect(quantityInCart(items, undefined)).toBe(0);
    expect(quantityInCart(undefined, 1788)).toBe(0);
  });

  it('never counts a line without a SKU for a product without one', () => {
    const noSku = [{ id: 'a', quantity: 2 }];
    expect(quantityInCart(noSku, undefined)).toBe(0);
    expect(quantityInCart([{ id: 'a', skuId: null, quantity: 2 }], null)).toBe(
      0,
    );
  });

  it('counts a line without a quantity as none', () => {
    expect(
      quantityInCart(
        [
          { id: 'a', skuId: 1788 },
          { id: 'b', skuId: 1788, quantity: 1 },
        ],
        1788,
      ),
    ).toBe(1);
  });
});

describe('stockLeft', () => {
  it('is the stock less what the cart holds', () => {
    expect(stockLeft(stock({ totalStock: 5 }), 2)).toBe(3);
  });

  it('is never below nothing', () => {
    expect(stockLeft(stock({ totalStock: 1 }), 3)).toBe(0);
  });

  it('is unlimited for oversellable stock', () => {
    expect(stockLeft(stock({ oversellable: 1 }), 1)).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  it('is unlimited for static stock', () => {
    expect(stockLeft(stock({ static: 1 }), 1)).toBe(Number.POSITIVE_INFINITY);
  });

  it('is unlimited when nothing is known about the stock', () => {
    expect(stockLeft(null, 1)).toBe(Number.POSITIVE_INFINITY);
    expect(stockLeft(undefined, 1)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('stockBlock', () => {
  it('says all of it is in the cart when the cart holds the whole stock', () => {
    expect(stockBlock(stock({ totalStock: 1 }), 1)).toBe('max_in_cart');
  });

  it('lets an add through while stock is left', () => {
    expect(stockBlock(stock({ totalStock: 2 }), 1)).toBeNull();
  });

  it('never limits oversellable stock', () => {
    expect(stockBlock(stock({ totalStock: 1, oversellable: 5 }), 1)).toBeNull();
  });

  it('never limits static stock', () => {
    expect(stockBlock(stock({ totalStock: 1, static: 5 }), 1)).toBeNull();
  });

  it('says out of stock when there is none, whatever the cart holds', () => {
    expect(stockBlock(stock({ totalStock: 0, inStock: 0 }), 0)).toBe(
      'out_of_stock',
    );
  });

  it('is nothing to say without a stock', () => {
    expect(stockBlock(null, 1)).toBeNull();
  });
});
