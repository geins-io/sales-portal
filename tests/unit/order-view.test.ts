import { describe, it, expect, vi } from 'vitest';
import type { OrderDetailType } from '#shared/types/commerce';
import {
  orderAmounts,
  orderPaymentLabel,
  orderRows,
  orderTotalRows,
} from '../../app/utils/order-view';

const price = (inc: number, ex: number) => ({
  sellingPriceIncVat: inc,
  sellingPriceIncVatFormatted: `${inc} inc`,
  sellingPriceExVat: ex,
  sellingPriceExVatFormatted: `${ex} ex`,
});

function makeOrder(overrides: Record<string, unknown> = {}): OrderDetailType {
  return {
    id: '1100',
    vat: {
      sellingPriceIncVat: 50,
      sellingPriceIncVatFormatted: '50 order-vat',
    },
    orderTotal: price(300, 240),
    cart: {
      items: [
        {
          product: {
            name: 'Widget',
            articleNumber: 'ART-1',
            alias: 'widget',
            canonicalUrl: '/c/widget',
            productImages: [{ fileName: 'w.jpg' }],
          },
          quantity: 2,
          unitPrice: price(125, 100),
          totalPrice: price(250, 200),
        },
        {
          product: {
            name: 'Cabinet',
            alias: 'cabinet',
            canonicalUrl: '/c/cab',
          },
          quantity: 1,
          unitPrice: price(50, 40),
          totalPrice: price(50, 40),
          configuration: { summary: [] },
        },
      ],
      summary: {
        subTotal: price(300, 240),
        total: { ...price(312.5, 250), vatFormatted: '62,50 vat' },
      },
    },
    ...overrides,
  } as unknown as OrderDetailType;
}

function withSummary(summary: Record<string, unknown>) {
  const { cart } = makeOrder();
  return makeOrder({
    cart: { ...cart, summary: { ...cart!.summary, ...summary } },
  });
}

describe('orderAmounts', () => {
  it.each([
    [true, '300 inc', '312.5 inc', undefined],
    [false, '240 ex', '250 ex', '312.5 inc'],
  ])(
    'reads every amount on the chosen side (incl. VAT: %s)',
    (incVat, subtotal, total, totalIncVat) => {
      expect(orderAmounts(makeOrder(), incVat)).toEqual({
        subtotal,
        shipping: undefined,
        paymentFee: undefined,
        discount: undefined,
        tax: '62,50 vat',
        total,
        totalIncVat,
      });
    },
  );

  it('takes VAT from the order when the cart summary has none', () => {
    const order = withSummary({ total: price(312.5, 250) });

    expect(orderAmounts(order, true).tax).toBe('50 order-vat');
  });

  it('falls back to the order total, side by side', () => {
    const order = withSummary({ total: undefined });

    expect(orderAmounts(order, true).total).toBe('300 inc');
    expect(orderAmounts(order, false)).toMatchObject({
      total: '240 ex',
      totalIncVat: '300 inc',
    });
  });

  it('has no inc line when the inc total is 0', () => {
    const order = makeOrder({
      orderTotal: undefined,
      cart: { ...makeOrder().cart, summary: { total: price(0, 0) } },
    });

    expect(orderAmounts(order, false).totalIncVat).toBeUndefined();
  });

  it.each([
    [true, '62,5 inc'],
    [false, '50 ex'],
  ])(
    'shows shipping from the cart summary when > 0 (incl. VAT: %s)',
    (incVat, value) => {
      const order = withSummary({
        shipping: {
          feeIncVat: 62.5,
          feeIncVatFormatted: '62,5 inc',
          feeExVat: 50,
          feeExVatFormatted: '50 ex',
        },
      });

      expect(orderAmounts(order, incVat).shipping).toBe(value);
    },
  );

  it.each([
    [true, '62.5 inc'],
    [false, '50 ex'],
  ])(
    "falls back to the order's shipping fee (incl. VAT: %s)",
    (incVat, value) => {
      const order = makeOrder({ shippingFee: price(62.5, 50) });

      expect(orderAmounts(order, incVat).shipping).toBe(value);
    },
  );

  it.each([
    [true, '25 inc'],
    [false, '20 ex'],
  ])('shows the payment fee when > 0 (incl. VAT: %s)', (incVat, value) => {
    const order = makeOrder({ paymentFee: price(25, 20) });

    expect(orderAmounts(order, incVat).paymentFee).toBe(value);
  });

  it.each([true, false])(
    'shows no fee of 0 or an empty string (incl. VAT: %s)',
    (incVat) => {
      const order = makeOrder({
        shippingFee: price(0, 0),
        paymentFee: {
          sellingPriceIncVat: 25,
          sellingPriceIncVatFormatted: '',
          sellingPriceExVat: 20,
          sellingPriceExVatFormatted: '',
        },
      });

      expect(orderAmounts(order, incVat)).toMatchObject({
        shipping: undefined,
        paymentFee: undefined,
      });
    },
  );

  it('reads the order total and no VAT from an order without a cart or VAT', () => {
    const order = makeOrder({ cart: undefined, vat: undefined });

    expect(orderAmounts(order, true)).toMatchObject({
      subtotal: undefined,
      tax: undefined,
      total: '300 inc',
    });
  });

  it.each([
    [true, /^25,00\skr$/],
    [false, /^20,00\skr$/],
  ])(
    'shows the order discount from the cart field, formatted (incl. VAT: %s)',
    (incVat, value) => {
      const order = withSummary({
        fixedAmountDiscountIncVat: 25,
        fixedAmountDiscountExVat: 20,
      });

      expect(orderAmounts(order, incVat, 'sv-SE').discount).toMatch(value);
    },
  );

  it("formats the discount in the cart total's currency", () => {
    const { cart } = makeOrder();
    const order = makeOrder({
      currency: 'NOK',
      cart: {
        ...cart,
        summary: {
          ...cart!.summary,
          total: { ...cart!.summary!.total, currency: { code: 'EUR' } },
          fixedAmountDiscountIncVat: 25,
        },
      },
    });

    expect(orderAmounts(order, true, 'en-GB').discount).toBe('€25.00');
  });

  it("falls back to the order's currency when the cart total has none", () => {
    const { cart } = makeOrder();
    const order = makeOrder({
      currency: 'EUR',
      cart: {
        ...cart,
        summary: { fixedAmountDiscountIncVat: 25 },
      },
    });

    expect(orderAmounts(order, true, 'en-GB').discount).toBe('€25.00');
  });

  it.each([0, -5, undefined])('shows no discount of %s', (amount) => {
    const order = withSummary({
      fixedAmountDiscountIncVat: amount,
      fixedAmountDiscountExVat: amount,
    });

    expect(orderAmounts(order, true, 'sv-SE').discount).toBeUndefined();
  });

  it('has nothing to show without an order', () => {
    expect(orderAmounts(undefined, false)).toEqual({
      subtotal: undefined,
      shipping: undefined,
      paymentFee: undefined,
      discount: undefined,
      tax: undefined,
      total: undefined,
      totalIncVat: undefined,
    });
  });
});

describe('orderRows', () => {
  it('maps every row on the chosen side, keyed by position', () => {
    const replay = vi.fn(() => '/replay');
    const rows = orderRows(makeOrder(), false, replay);

    expect(rows[0]).toEqual({
      key: 'row-0',
      name: 'Widget',
      articleNumber: 'ART-1',
      quantity: 2,
      unitPriceFormatted: '100 ex',
      totalPriceFormatted: '200 ex',
      imageFileName: 'w.jpg',
      alias: 'widget',
      href: undefined,
      configuration: undefined,
      skuName: undefined,
      unitPrice: price(125, 100),
      totalPrice: price(250, 200),
    });
    expect(rows[1]).toMatchObject({
      key: 'row-1',
      unitPriceFormatted: '40 ex',
      href: '/replay',
      configuration: { summary: [] },
    });
    // Only the configured row asks for a replay link, with its own position.
    expect(replay).toHaveBeenCalledTimes(1);
    expect(replay).toHaveBeenCalledWith('/c/cab', 1);
  });

  it('fills a row that carries nothing', () => {
    const order = makeOrder({ cart: { items: [{}] } });

    expect(orderRows(order, true, () => undefined)).toEqual([
      {
        key: 'row-0',
        name: '',
        articleNumber: undefined,
        quantity: 0,
        unitPriceFormatted: undefined,
        totalPriceFormatted: undefined,
        imageFileName: null,
        alias: null,
        href: undefined,
        configuration: undefined,
        skuName: undefined,
        unitPrice: undefined,
        totalPrice: undefined,
      },
    ]);
  });

  // The order's product carries only the ordered SKU, its id a string.
  describe('the ordered SKU', () => {
    const skuNameOf = (item: Record<string, unknown>) =>
      orderRows(
        makeOrder({ cart: { items: [item] } }),
        true,
        () => undefined,
      )[0]?.skuName;
    const product = (skus: unknown[]) => ({
      name: 'Skyddsglasögon klar EN 166',
      skus,
    });

    it('names the SKU of a product sold in several', () => {
      expect(
        skuNameOf({
          skuId: 1115,
          product: product([{ skuId: '1115', name: 'L' }]),
        }),
      ).toBe('L');
    });

    it('names it when both ids are numbers', () => {
      expect(
        skuNameOf({
          skuId: 1115,
          product: product([{ skuId: 1115, name: 'L' }]),
        }),
      ).toBe('L');
    });

    it('leaves out a SKU named as its product', () => {
      expect(
        skuNameOf({
          skuId: 1110,
          product: {
            name: 'Arbetsbord Pro',
            skus: [{ skuId: '1110', name: 'Arbetsbord Pro' }],
          },
        }),
      ).toBeUndefined();
    });

    it('leaves it out on a configured row', () => {
      expect(
        skuNameOf({
          skuId: 1115,
          product: product([{ skuId: '1115', name: 'L' }]),
          configuration: { summary: [] },
        }),
      ).toBeUndefined();
    });

    it('leaves it out when no SKU matches the row', () => {
      expect(
        skuNameOf({
          skuId: 1115,
          product: product([{ skuId: '1114', name: 'M' }]),
        }),
      ).toBeUndefined();
    });

    it('leaves out a SKU without a name', () => {
      expect(
        skuNameOf({ skuId: 1115, product: product([{ skuId: '1115' }]) }),
      ).toBeUndefined();
    });

    it('leaves out a blank name', () => {
      expect(
        skuNameOf({
          skuId: 1115,
          product: product([{ skuId: '1115', name: ' ' }]),
        }),
      ).toBeUndefined();
    });
  });

  it('has no rows for an order without a cart', () => {
    expect(
      orderRows(makeOrder({ cart: undefined }), true, () => undefined),
    ).toEqual([]);
  });

  it('asks a configured row without a product for its replay all the same', () => {
    const replay = vi.fn(() => undefined);
    orderRows(
      makeOrder({
        cart: { items: [{ quantity: 1, configuration: { summary: [] } }] },
      }),
      true,
      replay,
    );

    expect(replay).toHaveBeenCalledWith(undefined, 0);
  });

  it('has no rows without an order', () => {
    expect(orderRows(undefined, true, () => undefined)).toEqual([]);
  });
});

describe('orderTotalRows', () => {
  const t = (key: string, named?: Record<string, unknown>) =>
    named ? `${key}:${JSON.stringify(named)}` : key;

  it('lists every row the amounts carry, in the summary order', () => {
    const rows = orderTotalRows(
      {
        subtotal: 's',
        shipping: 'sh',
        paymentFee: 'pf',
        discount: 'd',
        tax: 'v',
        total: 'tot',
        totalIncVat: 'inc',
      },
      3,
      false,
      t,
      'Att betala inkl. moms',
    );

    expect(rows).toEqual([
      {
        label: 'portal.orders.detail.summary.subtotal_with_count:{"count":3}',
        value: 's',
      },
      { label: 'discount.discount', value: '-d' },
      { label: 'portal.orders.detail.summary.shipping', value: 'sh' },
      { label: 'common.payment_fee', value: 'pf' },
      { label: 'common.vat', value: 'v' },
      {
        label: 'portal.orders.detail.summary.total',
        value: 'tot',
        emphasis: true,
      },
      { label: 'Att betala inkl. moms', value: 'inc' },
    ]);
  });

  it('leaves out what the amounts lack, and labels VAT as included on the inc side', () => {
    const rows = orderTotalRows(
      { subtotal: 's', tax: 'v', total: 't' },
      1,
      true,
      t,
      'Totalt inkl. moms',
    );

    expect(rows.map((row) => row.label)).toEqual([
      'portal.orders.detail.summary.subtotal_with_count:{"count":1}',
      'common.vat_included',
      'portal.orders.detail.summary.total',
    ]);
  });
});

describe('orderPaymentLabel', () => {
  it('prefers the display name', () => {
    expect(
      orderPaymentLabel(
        makeOrder({
          paymentDetails: [
            { displayName: 'Faktura 30 dagar', name: 'Invoice' },
          ],
        }),
      ),
    ).toBe('Faktura 30 dagar');
  });

  it('falls back to the name', () => {
    expect(
      orderPaymentLabel(
        makeOrder({ paymentDetails: [{ displayName: ' ', name: 'Invoice' }] }),
      ),
    ).toBe('Invoice');
  });

  it('trims the name it falls back to', () => {
    expect(
      orderPaymentLabel(makeOrder({ paymentDetails: [{ name: ' Invoice ' }] })),
    ).toBe('Invoice');
  });

  it('has nothing to say when the display name is blank and there is no name', () => {
    expect(
      orderPaymentLabel(makeOrder({ paymentDetails: [{ displayName: ' ' }] })),
    ).toBe(undefined);
  });

  it('has nothing to say without payment details', () => {
    expect(orderPaymentLabel(makeOrder({ paymentDetails: undefined }))).toBe(
      undefined,
    );
    expect(orderPaymentLabel(makeOrder({ paymentDetails: [] }))).toBe(
      undefined,
    );
    expect(
      orderPaymentLabel(makeOrder({ paymentDetails: [{ name: '' }] })),
    ).toBe(undefined);
  });
});
