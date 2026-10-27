import { describe, it, expect } from 'vitest';
import {
  quoteAmounts,
  quoteDiscountLabel,
  quoteTotalRows,
} from '../../app/utils/quote-view';
import { makeQuote } from '../fixtures/quote';

// The two sonoralab quotations the ticket measured, as the API gives them.
const percentOff = () =>
  makeQuote({
    subtotal: 4087.25,
    subtotalFormatted: '4 087,25 kr',
    subtotalExVat: 3269.8,
    subtotalExVatFormatted: '3 269,80 kr',
    shipping: 250,
    shippingFormatted: '250 kr',
    shippingExVat: 200,
    shippingExVatFormatted: '200 kr',
    tax: 826.5775,
    taxFormatted: '826,58 kr',
    total: 4132.8875,
    totalFormatted: '4 132,89 kr',
    totalExVat: 3306.31,
    totalExVatFormatted: '3 306,31 kr',
    discount: 204.3625,
    discountExVat: 163.49,
    discountPercent: 5,
  });

const fixedOff = () =>
  makeQuote({
    subtotal: 168.75,
    subtotalFormatted: '168,75 kr',
    subtotalExVat: 135,
    subtotalExVatFormatted: '135 kr',
    shipping: 250,
    shippingFormatted: '250 kr',
    shippingExVat: 200,
    shippingExVatFormatted: '200 kr',
    tax: 71.25,
    taxFormatted: '71,25 kr',
    total: 356.25,
    totalFormatted: '356,25 kr',
    totalExVat: 285,
    totalExVatFormatted: '285 kr',
    discount: 62.5,
    discountExVat: 50,
  });

describe('quoteAmounts', () => {
  it('shows a percent discount on the inc side, with its rate', () => {
    expect(quoteAmounts(percentOff(), true, 'sv-SE')).toEqual({
      subtotal: '4 087,25 kr',
      discount: '204,36\u00a0kr',
      discountPercent: '5\u00a0%',
      shipping: '250 kr',
      tax: '826,58 kr',
      total: '4 132,89 kr',
    });
  });

  it('shows a percent discount on the ex side, with the inc total under it', () => {
    expect(quoteAmounts(percentOff(), false, 'sv-SE')).toEqual({
      subtotal: '3 269,80 kr',
      discount: '163,49\u00a0kr',
      discountPercent: '5\u00a0%',
      shipping: '200 kr',
      tax: '826,58 kr',
      total: '3 306,31 kr',
      totalIncVat: '4 132,89 kr',
    });
  });

  it.each([
    [true, '62,50\u00a0kr'],
    [false, '50,00\u00a0kr'],
  ])(
    'shows a fixed discount without a rate (incl. VAT: %s)',
    (incVat, discount) => {
      const amounts = quoteAmounts(fixedOff(), incVat, 'sv-SE');

      expect(amounts.discount).toBe(discount);
      expect(amounts).not.toHaveProperty('discountPercent');
    },
  );

  it('formats the discount in the quotation currency and locale', () => {
    const quote = { ...fixedOff(), currency: 'EUR' };

    expect(quoteAmounts(quote, true, 'en-GB').discount).toBe('€62.50');
  });

  it.each([
    ['0', { discount: 0, discountExVat: 0 }],
    ['missing', {}],
  ])('has no discount when it is %s', (_, overrides) => {
    const quote = makeQuote(overrides);

    for (const incVat of [true, false]) {
      const amounts = quoteAmounts(quote, incVat, 'sv-SE');
      expect(amounts).not.toHaveProperty('discount');
      expect(amounts).not.toHaveProperty('discountPercent');
    }
  });

  it('has no rate without a discount on the side shown', () => {
    const quote = makeQuote({
      discount: 0,
      discountExVat: 0,
      discountPercent: 5,
    });

    expect(quoteAmounts(quote, true, 'sv-SE')).not.toHaveProperty(
      'discountPercent',
    );
  });

  it('has no shipping without a fee', () => {
    expect(quoteAmounts(makeQuote(), true, 'sv-SE')).not.toHaveProperty(
      'shipping',
    );
  });

  it('has no inc line when the inc total is 0 or missing', () => {
    expect(
      quoteAmounts(makeQuote({ total: 0 }), false, 'sv-SE'),
    ).not.toHaveProperty('totalIncVat');
    expect(
      quoteAmounts(makeQuote({ totalFormatted: '' }), false, 'sv-SE'),
    ).not.toHaveProperty('totalIncVat');
  });

  it('has nothing to show without a quotation', () => {
    expect(quoteAmounts(null, true, 'sv-SE')).toEqual({});
  });
});

describe('quoteDiscountLabel', () => {
  const t = (key: string, named?: Record<string, unknown>) =>
    named ? `${key}:${JSON.stringify(named)}` : key;

  it('names the rate of a percent discount', () => {
    expect(
      quoteDiscountLabel({ discount: 'd', discountPercent: '5 %' }, t),
    ).toBe('portal.quotations.discount_percent:{"percent":"5 %"}');
  });

  it('says only "discount" for a fixed amount', () => {
    expect(quoteDiscountLabel({ discount: 'd' }, t)).toBe('discount.discount');
  });
});

describe('quoteTotalRows', () => {
  const t = (key: string, named?: Record<string, unknown>) =>
    named ? `${key}:${JSON.stringify(named)}` : key;

  it('lists every row the amounts carry, the discount right after the subtotal', () => {
    const rows = quoteTotalRows(
      {
        subtotal: 's',
        discount: 'd',
        discountPercent: '5 %',
        shipping: 'sh',
        tax: 'v',
        total: 'tot',
        totalIncVat: 'inc',
      },
      3,
      false,
      t,
    );

    expect(rows).toEqual([
      {
        label: 'portal.quotations.subtotal_with_count:{"count":3}',
        value: 's',
      },
      {
        label: 'portal.quotations.discount_percent:{"percent":"5 %"}',
        value: '-d',
      },
      { label: 'portal.quotations.shipping', value: 'sh' },
      { label: 'common.vat', value: 'v' },
      { label: 'portal.quotations.grand_total', value: 'tot', emphasis: true },
      { label: 'common.total_inc_vat', value: 'inc' },
    ]);
  });

  it('leaves out what the amounts lack, and labels VAT as included on the inc side', () => {
    const rows = quoteTotalRows(
      { subtotal: 's', tax: 'v', total: 't' },
      1,
      true,
      t,
    );

    expect(rows.map((row) => row.label)).toEqual([
      'portal.quotations.subtotal_with_count:{"count":1}',
      'common.vat_included',
      'portal.quotations.grand_total',
    ]);
  });
});
