import { describe, it, expect } from 'vitest';
import {
  currencyCode,
  exVatAmount,
} from '../../../shared/utils/configurator-price';

describe('exVatAmount', () => {
  it('reads the selling price before VAT', () => {
    expect(
      exVatAmount({ sellingPriceExVat: 150, sellingPriceIncVat: 187.5 }),
    ).toBe(150);
  });

  it('reads an absent price or amount as zero', () => {
    expect(exVatAmount(undefined)).toBe(0);
    expect(exVatAmount({ sellingPriceIncVat: 187.5 })).toBe(0);
  });
});

describe('currencyCode', () => {
  it('reads the code of the price currency', () => {
    expect(currencyCode({ currency: { code: 'EUR', symbol: '€' } })).toBe(
      'EUR',
    );
  });

  it('is undefined when the price or its currency is absent', () => {
    expect(currencyCode(undefined)).toBeUndefined();
    expect(currencyCode({ sellingPriceExVat: 1 })).toBeUndefined();
  });
});
