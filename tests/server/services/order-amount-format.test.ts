import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { H3Event } from 'h3';
import { GeinsCore, RuntimeContext } from '@geins/core';
import { GeinsOMS } from '@geins/oms';
import { makeRawQuotationCart } from '../../fixtures/quote';

/**
 * The order page's amounts are written by the SDK, from the numbers. The
 * quotation pages and the order list read Geins' own strings through raw
 * GraphQL, so the portal writes theirs. Both must come out byte for byte the
 * same for the same amount: the real SDK reads one order here, its fetch
 * answered locally.
 */

const mockGraphqlQuery = vi.fn();

vi.mock('../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue({
    core: { graphql: { query: mockGraphqlQuery } },
  }),
  buildRequestContext: vi.fn().mockReturnValue({ userToken: 'token' }),
  getRequestChannelVariables: vi.fn().mockReturnValue({
    channelId: '1|se',
    languageId: 'sv-SE',
    marketId: 'se',
  }),
}));
vi.mock('../../../server/services/graphql/loader', () => ({
  loadQuery: vi.fn((path: string) => path),
}));
vi.mock('../../../server/services/company', () => ({
  getCompany: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../../server/services/configurator', () => ({
  configurableCheck: () => () => false,
}));

vi.stubGlobal(
  'wrapServiceCall',
  vi.fn(async (fn: () => Promise<unknown>) => fn()),
);

const event = {} as H3Event;

/** 360 × 4 kr ex VAT, 5 kr inc: whole amounts, which Geins writes without decimals. */
const AMOUNTS = { unitInc: 5, unitEx: 4, totalInc: 1800, totalEx: 1440 };

function geinsPrice(inc: number, ex: number) {
  return {
    __typename: 'PriceType',
    sellingPriceIncVat: inc,
    sellingPriceExVat: ex,
    sellingPriceIncVatFormatted: `${inc} kr`,
    sellingPriceExVatFormatted: `${ex} kr`,
    vat: inc - ex,
    currency: { __typename: 'CurrencyType', code: 'SEK', name: 'SEK' },
  };
}

async function orderPageAmounts() {
  const unit = geinsPrice(AMOUNTS.unitInc, AMOUNTS.unitEx);
  const total = geinsPrice(AMOUNTS.totalInc, AMOUNTS.totalEx);
  const order = {
    __typename: 'OrderType',
    id: 1,
    publicId: 'public-1',
    currency: 'SEK',
    cart: {
      __typename: 'CartType',
      id: 'cart-1',
      items: [
        {
          __typename: 'CartItemType',
          id: 'item-1',
          skuId: 1,
          quantity: 360,
          unitPrice: unit,
          totalPrice: total,
        },
      ],
      summary: { __typename: 'CartSummaryType', subTotal: total, total },
    },
  };
  vi.stubGlobal('fetch', async () =>
    Response.json({ data: { getOrderPublic: order } }),
  );
  const core = new GeinsCore({
    apiKey: 'key',
    accountName: 'account',
    channel: '1',
    tld: 'se',
    locale: 'sv-SE',
    market: 'se',
    environment: 'prod',
  });
  const oms = new GeinsOMS(core, {
    omsSettings: { context: RuntimeContext.SERVER },
  });
  const read = await oms.order.get({ publicOrderId: 'public-1' });
  const item = read?.cart?.items?.[0];
  return {
    unitInc: item?.unitPrice?.sellingPriceIncVatFormatted,
    unitEx: item?.unitPrice?.sellingPriceExVatFormatted,
    totalInc: read?.cart?.summary?.total?.sellingPriceIncVatFormatted,
    totalEx: read?.cart?.summary?.total?.sellingPriceExVatFormatted,
  };
}

describe('order and quotation amounts are written as the order page writes them', () => {
  let orderPage: Awaited<ReturnType<typeof orderPageAmounts>>;

  beforeAll(async () => {
    orderPage = await orderPageAmounts();
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('the order page writes two decimals with non-breaking spaces (sv-SE)', () => {
    expect(orderPage).toEqual({
      unitInc: '5,00 kr',
      unitEx: '4,00 kr',
      totalInc: '1 800,00 kr',
      totalEx: '1 440,00 kr',
    });
  });

  it('a quotation line and its total match it', async () => {
    const cart = makeRawQuotationCart({ currency: 'SEK' });
    const unit = geinsPrice(AMOUNTS.unitInc, AMOUNTS.unitEx);
    const total = geinsPrice(AMOUNTS.totalInc, AMOUNTS.totalEx);
    const items = cart.items as Array<Record<string, unknown>>;
    items[0] = {
      ...items[0],
      quantity: 360,
      unitPrice: unit,
      totalPrice: total,
    };
    cart.summary = { subTotal: total, total };
    mockGraphqlQuery.mockResolvedValueOnce({ getQuotationCart: cart });
    const { getQuote } = await import('../../../server/services/quotes');

    const quote = await getQuote('cart-001', event);

    expect({
      unitInc: quote.lineItems[0]!.unitPriceFormatted,
      unitEx: quote.lineItems[0]!.unitPriceExVatFormatted,
      totalInc: quote.totalFormatted,
      totalEx: quote.totalExVatFormatted,
    }).toEqual(orderPage);
  });

  it("an order list row's total matches it", async () => {
    mockGraphqlQuery.mockResolvedValueOnce({
      getCompanyOrders: [
        {
          id: 1,
          status: 'Placed',
          publicId: 'public-1',
          currency: 'SEK',
          cart: {
            summary: {
              total: geinsPrice(AMOUNTS.totalInc, AMOUNTS.totalEx),
            },
          },
        },
      ],
    });
    const { listOrders } = await import('../../../server/services/orders');

    const { orders } = await listOrders(event);

    const total = orders[0]!.cart!.summary!.total!;
    expect(total.sellingPriceIncVatFormatted).toBe(orderPage.totalInc);
    expect(total.sellingPriceExVatFormatted).toBe(orderPage.totalEx);
  });
});
