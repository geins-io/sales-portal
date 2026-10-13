import { describe, it, expect } from 'vitest';
import {
  currencyCode,
  exVatAmount,
  incVatAmount,
  sideAmount,
  vatAmount,
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

describe('incVatAmount', () => {
  it('reads the selling price with VAT', () => {
    expect(
      incVatAmount({ sellingPriceExVat: 150, sellingPriceIncVat: 187.5 }),
    ).toBe(187.5);
  });

  it('reads an absent price or amount as zero', () => {
    expect(incVatAmount(undefined)).toBe(0);
    expect(incVatAmount({ sellingPriceExVat: 150 })).toBe(0);
  });
});

describe('vatAmount', () => {
  it('reads the VAT the price carries', () => {
    expect(vatAmount({ sellingPriceExVat: 150, vat: 37.5 })).toBe(37.5);
  });

  it('reads an absent price or amount as zero', () => {
    expect(vatAmount(undefined)).toBe(0);
    expect(vatAmount({ sellingPriceExVat: 150 })).toBe(0);
  });
});

describe('sideAmount', () => {
  const price = { sellingPriceExVat: 150, sellingPriceIncVat: 187.5 };

  it('reads the price before VAT on the ex side', () => {
    expect(sideAmount(price, false)).toBe(150);
  });

  it('reads the price with VAT on the inc side', () => {
    expect(sideAmount(price, true)).toBe(187.5);
  });

  it('reads an absent price as zero on both sides', () => {
    expect(sideAmount(undefined, false)).toBe(0);
    expect(sideAmount(undefined, true)).toBe(0);
  });
});
