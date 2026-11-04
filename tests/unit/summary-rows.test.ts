import { describe, it, expect } from 'vitest';
import { summaryRows } from '../../app/utils/summary-rows';

const t = (key: string, named?: Record<string, unknown>) =>
  named ? `${key}:${JSON.stringify(named)}` : key;

const every = {
  subtotal: 's',
  shipping: 'sh',
  paymentFee: 'pf',
  discount: 'd',
  tax: 'v',
  total: 'tot',
  totalIncVat: 'inc',
};

describe('summaryRows', () => {
  it('lists every row the amounts carry, in the summary order', () => {
    const rows = summaryRows(every, 3, false, t, {
      totalIncVatLabel: 'Att betala inkl. moms',
    });

    expect(rows).toEqual([
      {
        key: 'subtotal',
        label: 'portal.orders.detail.summary.subtotal_with_count:{"count":3}',
        value: 's',
      },
      { key: 'discount', label: 'discount.discount', value: '-d' },
      {
        key: 'shipping',
        label: 'portal.orders.detail.summary.shipping',
        value: 'sh',
      },
      { key: 'payment-fee', label: 'common.payment_fee', value: 'pf' },
      { key: 'tax', label: 'common.vat', value: 'v' },
      {
        key: 'total',
        label: 'portal.orders.detail.summary.total',
        value: 'tot',
        emphasis: true,
      },
      { key: 'total-inc-vat', label: 'Att betala inkl. moms', value: 'inc' },
    ]);
  });

  it('leaves out what the amounts lack, and labels VAT as included on the inc side', () => {
    const rows = summaryRows(
      { subtotal: 's', tax: 'v', total: 't' },
      1,
      true,
      t,
      {
        totalIncVatLabel: 'Totalt inkl. moms',
      },
    );

    expect(rows.map((row) => [row.key, row.label])).toEqual([
      [
        'subtotal',
        'portal.orders.detail.summary.subtotal_with_count:{"count":1}',
      ],
      ['tax', 'common.vat_included'],
      ['total', 'portal.orders.detail.summary.total'],
    ]);
  });

  it('labels the discount with the text it is given', () => {
    const rows = summaryRows(every, 3, true, t, {
      totalIncVatLabel: 'X',
      discountLabel: 'Rabatt 5 %',
    });

    expect(rows.find((row) => row.key === 'discount')).toEqual({
      key: 'discount',
      label: 'Rabatt 5 %',
      value: '-d',
    });
  });

  it('says where the shipping comes from while there is no shipping amount', () => {
    const rows = summaryRows(
      { subtotal: 's', tax: 'v', total: 't' },
      1,
      true,
      t,
      {
        totalIncVatLabel: 'X',
        shippingNote: 'Anges i offerten',
      },
    );

    expect(rows.map((row) => row.key)).toEqual([
      'subtotal',
      'shipping',
      'tax',
      'total',
    ]);
    expect(rows[1]).toEqual({
      key: 'shipping',
      label: 'portal.orders.detail.summary.shipping',
      value: 'Anges i offerten',
    });
  });

  it('shows the shipping amount over the note once there is one', () => {
    const rows = summaryRows(every, 1, true, t, {
      totalIncVatLabel: 'X',
      shippingNote: 'Anges i offerten',
    });

    expect(rows.find((row) => row.key === 'shipping')?.value).toBe('sh');
  });
});
