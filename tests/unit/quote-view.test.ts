import { describe, it, expect } from 'vitest';
import {
  quoteAcceptKind,
  quoteAmounts,
  quoteCanOrder,
  quoteDiscountLabel,
  quoteKindLabelKey,
  quoteResponses,
  quoteStatusInfoKey,
  quoteRows,
} from '../../app/utils/quote-view';
import type { QuoteStatus } from '../../shared/types/quote';
import { makeConfiguredQuoteLine, makeQuote } from '../fixtures/quote';

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

describe('quoteRows', () => {
  const quote = () =>
    makeQuote({
      lineItems: [
        makeQuote().lineItems[0]!,
        {
          ...makeQuote().lineItems[0]!,
          productId: 2,
          name: 'Gadget',
          articleNumber: 'ART-002',
          alias: 'gadget',
          imageFileName: undefined,
          imageUrl: 'https://cdn.example.test/g.jpg',
          quantity: 1,
          unitPriceFormatted: '50,00 kr',
          totalPriceFormatted: '50,00 kr',
          unitPriceExVatFormatted: '40,00 kr',
          totalPriceExVatFormatted: '40,00 kr',
        },
      ],
    });

  it('gives each line as a row, keyed by position, on the inc side', () => {
    expect(quoteRows(quote(), true)).toEqual([
      {
        key: 'row-0',
        name: 'Widget Pro',
        articleNumber: 'ART-001',
        quantity: 2,
        unitPriceFormatted: '100,00 kr',
        totalPriceFormatted: '200,00 kr',
        imageFileName: '/img/widget.jpg',
        imageUrl: null,
        alias: null,
      },
      {
        key: 'row-1',
        name: 'Gadget',
        articleNumber: 'ART-002',
        quantity: 1,
        unitPriceFormatted: '50,00 kr',
        totalPriceFormatted: '50,00 kr',
        imageFileName: null,
        imageUrl: 'https://cdn.example.test/g.jpg',
        alias: 'gadget',
      },
    ]);
  });

  it('prices every row on the ex side when the buyer shows ex VAT', () => {
    expect(
      quoteRows(quote(), false).map((row) => [
        row.unitPriceFormatted,
        row.totalPriceFormatted,
      ]),
    ).toEqual([
      ['80,00 kr', '160,00 kr'],
      ['40,00 kr', '40,00 kr'],
    ]);
  });

  it('gives a configured line its configuration and its prices', () => {
    const line = makeConfiguredQuoteLine();
    const [row] = quoteRows(makeQuote({ lineItems: [line] }), false);

    expect(row).toMatchObject({
      name: 'Configured Display',
      configuration: line.configuration,
      unitPrice: line.linePrices!.unit,
      totalPrice: line.linePrices!.total,
      unitPriceFormatted: '23 405,36 kr',
      totalPriceFormatted: '23 405,36 kr',
    });
    expect(row).not.toHaveProperty('href');
  });

  it('gives a configured line without its prices no price objects', () => {
    const line = makeConfiguredQuoteLine({ linePrices: undefined });
    const [row] = quoteRows(makeQuote({ lineItems: [line] }), true);

    expect(row!.configuration).toEqual(line.configuration);
    expect(row!.unitPrice).toBeUndefined();
    expect(row!.totalPrice).toBeUndefined();
  });

  it('gives an ordinary line no configuration and no price objects', () => {
    const [row] = quoteRows(makeQuote(), true);

    expect(row).not.toHaveProperty('configuration');
    expect(row).not.toHaveProperty('unitPrice');
    expect(row).not.toHaveProperty('totalPrice');
  });

  it('keys two lines of one SKU apart', () => {
    const one = makeQuote().lineItems[0]!;
    const rows = quoteRows(makeQuote({ lineItems: [one, one] }), true);

    expect(rows.map((row) => row.key)).toEqual(['row-0', 'row-1']);
  });

  it('has no rows without a quotation', () => {
    expect(quoteRows(null, true)).toEqual([]);
  });
});

describe('quoteAcceptKind', () => {
  it('is plain when the seller asks for no confirmation', () => {
    expect(quoteAcceptKind(makeQuote({ requiresConfirmation: false }))).toBe(
      'plain',
    );
  });

  it('is plain when the setting is missing', () => {
    expect(quoteAcceptKind(makeQuote())).toBe('plain');
  });

  it('is confirm when the seller confirms first', () => {
    expect(quoteAcceptKind(makeQuote({ requiresConfirmation: true }))).toBe(
      'confirm',
    );
  });
});

describe('quoteCanOrder', () => {
  const others: QuoteStatus[] = [
    'request_draft',
    'requested',
    'finalized',
    'rejected',
    'canceled',
    'expired',
    'unknown',
  ];

  it.each<QuoteStatus>(['pending', 'accepted'])(
    'orders a %s quotation that needs no confirmation',
    (status) => {
      expect(quoteCanOrder(makeQuote({ status }))).toBe(true);
    },
  );

  it('does not order a confirmed one that never needed confirmation', () => {
    expect(quoteCanOrder(makeQuote({ status: 'confirmed' }))).toBe(false);
  });

  it('orders a quotation that needs confirmation only once confirmed', () => {
    const confirm = { requiresConfirmation: true };
    expect(quoteCanOrder(makeQuote({ status: 'confirmed', ...confirm }))).toBe(
      true,
    );
    expect(quoteCanOrder(makeQuote({ status: 'pending', ...confirm }))).toBe(
      false,
    );
    expect(quoteCanOrder(makeQuote({ status: 'accepted', ...confirm }))).toBe(
      false,
    );
  });

  it.each(others)('does not order a %s quotation', (status) => {
    expect(quoteCanOrder(makeQuote({ status }))).toBe(false);
    expect(
      quoteCanOrder(makeQuote({ status, requiresConfirmation: true })),
    ).toBe(false);
  });
});

describe('quoteResponses', () => {
  const k = (key: string) => `portal.quotations.${key}`;
  const none = {
    withdraw: false,
    decline: false,
    accept: null,
    placeOrder: false,
  };
  const confirm = { requiresConfirmation: true };

  it.each([true, false])(
    'lets a sent request be withdrawn, nothing else (orders: %s)',
    (canPlaceOrders) => {
      expect(
        quoteResponses(makeQuote({ status: 'requested' }), canPlaceOrders),
      ).toEqual({ ...none, withdraw: true });
    },
  );

  describe('pending', () => {
    it('without confirmation, accepting is ordering: it goes to the order page', () => {
      expect(quoteResponses(makeQuote({ status: 'pending' }), true)).toEqual({
        ...none,
        decline: true,
        accept: 'order',
        noteKey: k('note_order'),
      });
    });

    it('without confirmation and without order rights, only accepts, in a dialog', () => {
      expect(quoteResponses(makeQuote({ status: 'pending' }), false)).toEqual({
        ...none,
        decline: true,
        accept: 'plain',
        acceptBodyKey: k('accept_plain_body'),
      });
    });

    it('with confirmation, says the order follows the seller', () => {
      expect(
        quoteResponses(makeQuote({ status: 'pending', ...confirm }), true),
      ).toEqual({
        ...none,
        decline: true,
        accept: 'confirm',
        acceptBodyKey: k('accept_confirm_order_body'),
        noteKey: k('note_confirm_order'),
      });
    });

    it('with confirmation and without order rights, promises no order', () => {
      expect(
        quoteResponses(makeQuote({ status: 'pending', ...confirm }), false),
      ).toEqual({
        ...none,
        decline: true,
        accept: 'confirm',
        acceptBodyKey: k('accept_confirm_body'),
        noteKey: k('note_confirm'),
      });
    });
  });

  it.each([
    ['accepted without confirmation', { status: 'accepted' }],
    ['confirmed', { status: 'confirmed', ...confirm }],
  ] as const)('offers "place order" on %s', (_, overrides) => {
    expect(quoteResponses(makeQuote(overrides), true)).toEqual({
      ...none,
      placeOrder: true,
    });
    expect(quoteResponses(makeQuote(overrides), false)).toEqual(none);
  });

  it.each([
    ['accepted, waiting for the seller', { status: 'accepted', ...confirm }],
    ['confirmed without needing it', { status: 'confirmed' }],
  ] as const)('offers nothing on %s', (_, overrides) => {
    expect(quoteResponses(makeQuote(overrides), true)).toEqual(none);
  });

  it.each<QuoteStatus>([
    'request_draft',
    'finalized',
    'rejected',
    'canceled',
    'expired',
    'unknown',
  ])('offers no response on %s', (status) => {
    for (const canPlaceOrders of [true, false]) {
      expect(quoteResponses(makeQuote({ status }), canPlaceOrders)).toEqual(
        none,
      );
    }
  });
});

describe('quoteStatusInfoKey', () => {
  it.each<[QuoteStatus, string]>([
    ['requested', 'portal.quotations.status_info_requested'],
    ['pending', 'portal.quotations.status_info_pending'],
    ['confirmed', 'portal.quotations.status_info_confirmed'],
    ['finalized', 'portal.quotations.status_info_finalized'],
    ['rejected', 'portal.quotations.status_info_rejected'],
    ['canceled', 'portal.quotations.status_info_canceled'],
    ['expired', 'portal.quotations.status_info_expired'],
  ])('explains %s', (status, key) => {
    expect(quoteStatusInfoKey(makeQuote({ status }), false)).toBe(key);
  });

  it.each<QuoteStatus>([
    'requested',
    'pending',
    'confirmed',
    'finalized',
    'rejected',
    'canceled',
    'expired',
  ])(
    'says nothing about ordering on %s when the quotation cannot be ordered',
    (status) => {
      expect(quoteStatusInfoKey(makeQuote({ status }), true)).toBe(
        `portal.quotations.status_info_${status}`,
      );
    },
  );

  it.each([
    [{}, 'portal.quotations.status_info_accepted_plain'],
    [
      { requiresConfirmation: true },
      'portal.quotations.status_info_accepted_confirm',
    ],
  ])('explains an accepted quotation by how it was accepted (%j)', (o, key) => {
    expect(
      quoteStatusInfoKey(makeQuote({ status: 'accepted', ...o }), false),
    ).toBe(key);
  });

  it.each([
    ['accepted', {}, 'portal.quotations.status_info_accepted_plain_order'],
    [
      'confirmed',
      { requiresConfirmation: true },
      'portal.quotations.status_info_confirmed_order',
    ],
  ] as const)(
    'tells a buyer who can order that they can, on %s',
    (status, o, key) => {
      const quote = makeQuote({ status, ...o });
      expect(quoteStatusInfoKey(quote, true)).toBe(key);
      expect(quoteStatusInfoKey(quote, false)).toBe(key.replace('_order', ''));
    },
  );

  it.each([[{ requiresConfirmation: true }, 'status_info_accepted_confirm']])(
    'promises no order on an accepted quotation that cannot be ordered (%j)',
    (o, key) => {
      expect(
        quoteStatusInfoKey(makeQuote({ status: 'accepted', ...o }), true),
      ).toBe(`portal.quotations.${key}`);
    },
  );

  it.each<QuoteStatus>(['request_draft', 'unknown'])(
    'has no text for %s',
    (status) => {
      expect(quoteStatusInfoKey(makeQuote({ status }), true)).toBeUndefined();
    },
  );
});

describe('quoteKindLabelKey', () => {
  it.each<[QuoteStatus, string]>([
    ['request_draft', 'portal.quotations.kind_request'],
    ['requested', 'portal.quotations.kind_request'],
    ['pending', 'portal.quotations.kind_quotation'],
    ['accepted', 'portal.quotations.kind_quotation'],
    ['rejected', 'portal.quotations.kind_quotation'],
    ['unknown', 'portal.quotations.kind_quotation'],
  ])('calls a %s one %s', (status, key) => {
    expect(quoteKindLabelKey(status)).toBe(key);
  });
});
