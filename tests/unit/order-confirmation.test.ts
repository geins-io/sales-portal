import { describe, it, expect } from 'vitest';
import type { OrderDetailType } from '#shared/types/commerce';
import {
  orderToConfirmation,
  orderPaymentLabel,
} from '../../app/utils/order-confirmation';

const configuration = {
  summary: [{ label: 'Colour', value: 'Red' }],
};

/** Shaped like `/api/orders/<publicId>` for a measured order on the test account. */
function makeOrder(overrides: Record<string, unknown> = {}): OrderDetailType {
  return {
    id: '1100',
    publicId: '8dd16643-0000-0000-0000-000000000000',
    status: 'pending',
    currency: 'SEK',
    customerOrderNumber: 'PO-77',
    billingAddress: {
      company: 'Acme Corp',
      firstName: 'John',
      lastName: 'Doe',
      addressLine1: 'Storgatan 1',
      zip: '111 22',
      city: 'Stockholm',
      country: 'SE',
    },
    shippingAddress: {
      company: 'Acme Warehouse',
      addressLine1: 'Lagervagen 5',
      zip: '333 44',
      city: 'Gothenburg',
      country: 'SE',
    },
    cart: {
      items: [
        {
          product: { name: 'Widget Pro', articleNumber: 'ART-001' },
          skuId: 1001,
          quantity: 3,
          unitPrice: {
            sellingPriceIncVat: 150,
            sellingPriceIncVatFormatted: '150,00 kr',
            sellingPriceExVat: 120,
            sellingPriceExVatFormatted: '120,00 kr',
          },
          totalPrice: {
            sellingPriceIncVat: 450,
            sellingPriceIncVatFormatted: '450,00 kr',
            sellingPriceExVat: 360,
            sellingPriceExVatFormatted: '360,00 kr',
          },
        },
        {
          product: { name: 'Configured Cabinet', articleNumber: 'ART-002' },
          skuId: 1002,
          quantity: 1,
          unitPrice: {
            sellingPriceIncVat: 200,
            sellingPriceIncVatFormatted: '200,00 kr',
            sellingPriceExVat: 160,
            sellingPriceExVatFormatted: '160,00 kr',
          },
          totalPrice: {
            sellingPriceIncVat: 200,
            sellingPriceIncVatFormatted: '200,00 kr',
            sellingPriceExVat: 160,
            sellingPriceExVatFormatted: '160,00 kr',
          },
          configuration,
        },
      ],
      summary: {
        subTotal: {
          sellingPriceIncVat: 650,
          sellingPriceIncVatFormatted: '650,00 kr',
          sellingPriceExVat: 520,
          sellingPriceExVatFormatted: '520,00 kr',
        },
        total: {
          sellingPriceIncVat: 699,
          sellingPriceIncVatFormatted: '699,00 kr',
          sellingPriceExVat: 559.2,
          sellingPriceExVatFormatted: '559,20 kr',
          vat: 139.8,
          vatFormatted: '139,80 kr',
        },
      },
    },
    orderTotal: {
      sellingPriceIncVat: 699,
      sellingPriceIncVatFormatted: '699,00 kr',
      sellingPriceExVat: 559.2,
      sellingPriceExVatFormatted: '559,20 kr',
    },
    discount: {
      sellingPriceIncVat: 25,
      sellingPriceIncVatFormatted: '25,00 kr',
      sellingPriceExVat: 20,
      sellingPriceExVatFormatted: '20,00 kr',
    },
    vat: {
      sellingPriceIncVat: 139.8,
      sellingPriceIncVatFormatted: '139,80 kr (order)',
    },
    paymentDetails: [{ displayName: 'Faktura 30 dagar', name: 'Invoice' }],
    ...overrides,
  } as unknown as OrderDetailType;
}

describe('orderToConfirmation', () => {
  it('shows the numeric order id on the badge', () => {
    expect(orderToConfirmation(makeOrder()).orderId).toBe('1100');
  });

  it('carries both addresses as they are', () => {
    const order = makeOrder();
    const summary = orderToConfirmation(order);

    expect(summary.billingAddress).toEqual(order.billingAddress);
    expect(summary.shippingAddress).toEqual(order.shippingAddress);
  });

  it('maps every order row, in order', () => {
    const rows = orderToConfirmation(makeOrder()).rows ?? [];

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      name: 'Widget Pro',
      product: { name: 'Widget Pro' },
      articleNumber: 'ART-001',
      skuId: '1001',
      quantity: 3,
      price: {
        priceIncVat: 150,
        priceIncVatFormatted: '150,00 kr',
        priceExVat: 120,
        priceExVatFormatted: '120,00 kr',
      },
    });
  });

  it("keeps each row's own unit and line price for display", () => {
    const order = makeOrder();
    const row = orderToConfirmation(order).rows![0]!;

    expect(row.unitPrice).toEqual(order.cart!.items[0]!.unitPrice);
    expect(row.totalPrice).toEqual(order.cart!.items[0]!.totalPrice);
  });

  it('carries a configured row its configuration, and a plain row none', () => {
    const rows = orderToConfirmation(makeOrder()).rows!;

    expect(rows[0]!.configuration).toBeUndefined();
    expect(rows[1]!.configuration).toEqual(configuration);
  });

  it('takes the subtotal from the cart summary, both sides', () => {
    expect(orderToConfirmation(makeOrder()).total).toMatchObject({
      itemValueIncVat: 650,
      itemValueIncVatFormatted: '650,00 kr',
      itemValueExVat: 520,
      itemValueExVatFormatted: '520,00 kr',
    });
  });

  it('takes the charged amount and the ex-VAT total from the cart summary', () => {
    expect(orderToConfirmation(makeOrder()).total).toMatchObject({
      sum: 699,
      sumFormatted: '699,00 kr',
      orderValueIncVat: 699,
      orderValueIncVatFormatted: '699,00 kr',
      orderValueExVat: 559.2,
      orderValueExVatFormatted: '559,20 kr',
    });
  });

  it('falls back to the order total when the cart summary has none', () => {
    const { cart } = makeOrder();
    const order = makeOrder({
      cart: { ...cart, summary: { ...cart!.summary, total: undefined } },
      orderTotal: {
        sellingPriceIncVat: 700,
        sellingPriceIncVatFormatted: '700,00 kr',
        sellingPriceExVat: 560,
        sellingPriceExVatFormatted: '560,00 kr',
      },
    });

    expect(orderToConfirmation(order).total).toMatchObject({
      sum: 700,
      sumFormatted: '700,00 kr',
      orderValueExVat: 560,
      orderValueExVatFormatted: '560,00 kr',
    });
  });

  it('falls back per field, as the order detail page does', () => {
    const { cart } = makeOrder();
    const order = makeOrder({
      cart: {
        ...cart,
        summary: {
          ...cart!.summary,
          total: {
            sellingPriceIncVat: 699,
            sellingPriceIncVatFormatted: '699,00 kr',
          },
        },
      },
      orderTotal: {
        sellingPriceIncVat: 700,
        sellingPriceIncVatFormatted: '700,00 kr',
        sellingPriceExVat: 560,
        sellingPriceExVatFormatted: '560,00 kr',
      },
    });

    // The cart summary's own figure wins where it has one; the order total
    // fills only what it lacks.
    expect(orderToConfirmation(order).total).toMatchObject({
      sum: 699,
      sumFormatted: '699,00 kr',
      orderValueIncVat: 699,
      orderValueIncVatFormatted: '699,00 kr',
      orderValueExVat: 560,
      orderValueExVatFormatted: '560,00 kr',
    });
  });

  it('takes VAT from the same field as the order detail page', () => {
    expect(orderToConfirmation(makeOrder()).total?.vatFormatted).toBe(
      '139,80 kr',
    );
  });

  it("falls back to the order's own VAT, as the order detail page does", () => {
    const order = makeOrder();
    order.cart!.summary!.total = {
      ...order.cart!.summary!.total,
      vatFormatted: undefined,
    };

    expect(orderToConfirmation(order).total?.vatFormatted).toBe(
      '139,80 kr (order)',
    );
  });

  it('takes shipping from the cart summary, both sides', () => {
    const { cart } = makeOrder();
    const order = makeOrder({
      cart: {
        ...cart,
        summary: {
          ...cart!.summary,
          shipping: {
            feeIncVat: 62.5,
            feeIncVatFormatted: '62,50 kr',
            feeExVat: 50,
            feeExVatFormatted: '50,00 kr',
          },
        },
      },
      shippingFee: {
        sellingPriceIncVat: 1,
        sellingPriceIncVatFormatted: '1,00 kr',
        sellingPriceExVat: 1,
        sellingPriceExVatFormatted: '1,00 kr',
      },
    });

    expect(orderToConfirmation(order).total).toMatchObject({
      shippingFeeIncVat: 62.5,
      shippingFeeIncVatFormatted: '62,50 kr',
      shippingFeeExVat: 50,
      shippingFeeExVatFormatted: '50,00 kr',
    });
  });

  it("falls back to the order's shipping fee, field by field", () => {
    const { cart } = makeOrder();
    const order = makeOrder({
      cart: {
        ...cart,
        summary: {
          ...cart!.summary,
          shipping: { feeIncVat: 62.5, feeIncVatFormatted: '62,50 kr' },
        },
      },
      shippingFee: {
        sellingPriceIncVat: 1,
        sellingPriceIncVatFormatted: '1,00 kr',
        sellingPriceExVat: 50,
        sellingPriceExVatFormatted: '50,00 kr',
      },
    });

    expect(orderToConfirmation(order).total).toMatchObject({
      shippingFeeIncVat: 62.5,
      shippingFeeIncVatFormatted: '62,50 kr',
      shippingFeeExVat: 50,
      shippingFeeExVatFormatted: '50,00 kr',
    });
  });

  it("falls back to the order's shipping fee on the inc side too", () => {
    const { cart } = makeOrder();
    const order = makeOrder({
      cart: {
        ...cart,
        summary: {
          ...cart!.summary,
          shipping: { feeExVat: 50, feeExVatFormatted: '50,00 kr' },
        },
      },
      shippingFee: {
        sellingPriceIncVat: 62.5,
        sellingPriceIncVatFormatted: '62,50 kr',
        sellingPriceExVat: 1,
        sellingPriceExVatFormatted: '1,00 kr',
      },
    });

    expect(orderToConfirmation(order).total).toMatchObject({
      shippingFeeIncVat: 62.5,
      shippingFeeIncVatFormatted: '62,50 kr',
      shippingFeeExVat: 50,
      shippingFeeExVatFormatted: '50,00 kr',
    });
  });

  it('takes the payment fee from the order, both sides', () => {
    const order = makeOrder({
      paymentFee: {
        sellingPriceIncVat: 25,
        sellingPriceIncVatFormatted: '25,00 kr',
        sellingPriceExVat: 20,
        sellingPriceExVatFormatted: '20,00 kr',
      },
    });

    expect(orderToConfirmation(order).total).toMatchObject({
      paymentFeeIncVat: 25,
      paymentFeeIncVatFormatted: '25,00 kr',
      paymentFeeExVat: 20,
      paymentFeeExVatFormatted: '20,00 kr',
    });
  });

  it('takes the discount from the order, both sides', () => {
    expect(orderToConfirmation(makeOrder()).total).toMatchObject({
      discountIncVat: 25,
      discountIncVatFormatted: '25,00 kr',
      discountExVat: 20,
      discountExVatFormatted: '20,00 kr',
    });
  });

  it('carries the currency', () => {
    expect(orderToConfirmation(makeOrder()).total?.currency).toBe('SEK');
  });

  it('maps a row that carries no product, sku or price', () => {
    const order = makeOrder();
    const summary = orderToConfirmation(
      makeOrder({ cart: { ...order.cart, items: [{ quantity: 2 }] } }),
    );

    expect(summary.rows).toEqual([
      expect.objectContaining({
        name: undefined,
        product: { name: undefined },
        articleNumber: undefined,
        skuId: undefined,
        quantity: 2,
        price: {
          priceIncVat: undefined,
          priceIncVatFormatted: undefined,
          priceExVat: undefined,
          priceExVatFormatted: undefined,
        },
      }),
    ]);
  });

  it('leaves out what the order does not have rather than inventing a zero', () => {
    const summary = orderToConfirmation(
      makeOrder({
        cart: undefined,
        orderTotal: undefined,
        discount: undefined,
      }),
    );

    expect(summary.rows).toEqual([]);
    expect(summary.total?.sum).toBeUndefined();
    expect(summary.total?.itemValueExVat).toBeUndefined();
    expect(summary.total?.discountIncVat).toBeUndefined();
    expect(summary.total?.shippingFeeIncVat).toBeUndefined();
    expect(summary.total?.paymentFeeIncVat).toBeUndefined();
  });
});

describe('orderPaymentLabel', () => {
  it('prefers the display name', () => {
    expect(orderPaymentLabel(makeOrder())).toBe('Faktura 30 dagar');
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
