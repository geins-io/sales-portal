import { describe, it, expect } from 'vitest';
import { getStockStatus, formatPrice } from '../../shared/types/commerce';

describe('getStockStatus', () => {
  it('returns in-stock when totalStock > threshold', () => {
    expect(getStockStatus({ totalStock: 100, inStock: 100, static: 0 })).toBe(
      'in-stock',
    );
  });

  it('returns low-stock when totalStock <= threshold', () => {
    expect(getStockStatus({ totalStock: 3, inStock: 3, static: 0 })).toBe(
      'low-stock',
    );
  });

  it('returns out-of-stock when totalStock === 0', () => {
    expect(getStockStatus({ totalStock: 0, inStock: 0, static: 0 })).toBe(
      'out-of-stock',
    );
  });

  it('returns on-demand when static > 0 and totalStock === 0', () => {
    expect(getStockStatus({ totalStock: 0, inStock: 0, static: 10 })).toBe(
      'on-demand',
    );
  });

  it('respects custom threshold', () => {
    expect(getStockStatus({ totalStock: 8, inStock: 8, static: 0 }, 10)).toBe(
      'low-stock',
    );
    expect(getStockStatus({ totalStock: 8, inStock: 8, static: 0 }, 5)).toBe(
      'in-stock',
    );
  });

  it('on-demand takes priority over out-of-stock', () => {
    expect(getStockStatus({ totalStock: 0, inStock: 0, static: 5 })).toBe(
      'on-demand',
    );
  });
});

describe('formatPrice', () => {
  it('formats with default SEK locale', () => {
    const result = formatPrice(199, 'SEK', 'sv-SE');
    expect(result).toMatch(/199/);
    expect(result).toMatch(/kr/);
  });

  it('formats with EUR', () => {
    const result = formatPrice(49.99, 'EUR', 'de-DE');
    expect(result).toMatch(/49,99/);
    expect(result).toMatch(/€/);
  });

  it('formats with USD', () => {
    const result = formatPrice(29.99, 'USD', 'en-US');
    expect(result).toContain('$');
    expect(result).toContain('29.99');
  });
});
