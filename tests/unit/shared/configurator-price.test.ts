import { describe, it, expect } from 'vitest';
import {
  currencyCode,
  exVatAmount,
  incVatAmount,
  vatAmount,
  vatRatePercent,
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

describe('vatRatePercent', () => {
  it('restates the VAT amount as a percentage of the price before VAT', () => {
    expect(vatRatePercent({ sellingPriceExVat: 3200, vat: 800 })).toBe(25);
  });

  it('rounds to a whole percentage', () => {
    expect(vatRatePercent({ sellingPriceExVat: 99.99, vat: 12.5 })).toBe(13);
    expect(vatRatePercent({ sellingPriceExVat: 100, vat: 12.4 })).toBe(12);
  });

  it('has no rate for a price of zero', () => {
    // Parts the provider includes arrive at 0.00, and 0 / 0 is no rate.
    expect(vatRatePercent({ sellingPriceExVat: 0, vat: 0 })).toBeNull();
  });

  it('has no rate when the price or its VAT is absent', () => {
    expect(vatRatePercent(undefined)).toBeNull();
    expect(vatRatePercent({ sellingPriceExVat: 100 })).toBeNull();
    expect(vatRatePercent({ vat: 25 })).toBeNull();
  });

  it('reads a VAT-free price as zero percent', () => {
    expect(vatRatePercent({ sellingPriceExVat: 100, vat: 0 })).toBe(0);
  });
});
