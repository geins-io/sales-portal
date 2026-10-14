import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, type Ref } from 'vue';
import { mountComponent } from '../../utils/component';
import { mockShowIncVat } from '../../setup-components';

/**
 * The confirmation page, both ways a buyer lands on it.
 *
 * In-app (`?orderId=<publicId>&orderNumber=<id>`, from checkout.vue): the page
 * reads the order the portal reads and waits for it, because Geins's checkout
 * summary never carries an order placed through `createOrder`.
 *
 * Hosted (`?geins-cart=…`, Geins's redirect): the thank-you header only. A
 * hosted order returns with nothing to read, so nothing is asked.
 */

type FetchResult = {
  data: Ref<unknown>;
  pending: Ref<boolean>;
  error: Ref<Error | null>;
};

const results = new Map<string, FetchResult>();

function resultFor(url: string): FetchResult {
  let result = results.get(url);
  if (!result) {
    result = { data: ref(null), pending: ref(false), error: ref(null) };
    results.set(url, result);
  }
  return result;
}

const useFetchMock = vi.fn(
  (url: string | (() => string), _options?: Record<string, unknown>) =>
    resultFor(typeof url === 'function' ? url() : url),
);

const mockQuery = ref<Record<string, string>>({});
const mockPollFetch = vi.fn();

vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: Parameters<typeof useFetchMock>) => useFetchMock(...args),
}));

vi.mock('#app/composables/router', () => ({
  useRoute: () => ({ query: mockQuery.value }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  navigateTo: vi.fn(),
}));

vi.stubGlobal('useFetch', useFetchMock);
vi.stubGlobal('definePageMeta', vi.fn());
vi.stubGlobal('$fetch', (...args: unknown[]) => mockPollFetch(...args));

const { default: ConfirmationPage } =
  await import('../../../app/pages/order-confirmation/index.vue');

const PUBLIC_ID = '8dd16643-aaaa-bbbb-cccc-000000000000';
const ORDER_URL = `/api/orders/${PUBLIC_ID}`;
const SUMMARY_URL = '/api/checkout/summary';

function makeOrder() {
  return {
    order: {
      id: '1100',
      publicId: PUBLIC_ID,
      currency: 'SEK',
      customerOrderNumber: 'PO-77',
      goodsLabel: 'Dock 4',
      billingAddress: { company: 'Acme' },
      shippingAddress: { company: 'Warehouse' },
      cart: {
        items: [
          {
            product: { name: 'Widget Pro', articleNumber: 'ART-001' },
            quantity: 3,
            unitPrice: {
              sellingPriceIncVatFormatted: '150,00 kr',
              sellingPriceExVatFormatted: '120,00 kr',
            },
            totalPrice: {
              sellingPriceIncVatFormatted: '450,00 kr',
              sellingPriceExVatFormatted: '360,00 kr',
            },
          },
        ],
        summary: {
          subTotal: { sellingPriceIncVatFormatted: '450,00 kr' },
          total: {
            sellingPriceIncVat: 450,
            sellingPriceIncVatFormatted: '450,00 kr',
            vatFormatted: '90,00 kr',
          },
        },
      },
      paymentDetails: [{ displayName: 'Faktura 30 dagar' }],
    },
  };
}

const OrderConfirmationStub = {
  name: 'OrderConfirmation',
  props: ['orderNumber', 'publicOrderId'],
  template: '<div data-testid="order-confirmation"><slot /></div>',
};

// The order's own parts, shared with the portal order page.
const partStub = (name: string, props: string[]) => ({
  name,
  props,
  template: `<div data-testid="${name}" />`,
});
const OrderItemsTableStub = partStub('OrderItemsTable', [
  'items',
  'amounts',
  'itemCount',
  'totalIncVatLabel',
]);
const OrderSummaryCardStub = partStub('OrderSummaryCard', [
  'amounts',
  'itemCount',
  'totalIncVatLabel',
]);
const OrderAddressesStub = partStub('OrderAddresses', [
  'billingAddress',
  'shippingAddress',
  'customerOrderNumber',
  'goodsLabel',
  'desiredDeliveryDate',
  'paymentMethod',
]);
const SheetStub = partStub('PortalItemRowsSheet', [
  'items',
  'totals',
  'triggerLabel',
  'title',
]);

function mount() {
  return mountComponent(ConfirmationPage, {
    global: {
      stubs: {
        OrderConfirmation: OrderConfirmationStub,
        OrderItemsTable: OrderItemsTableStub,
        OrderSummaryCard: OrderSummaryCardStub,
        OrderAddresses: OrderAddressesStub,
        PortalItemRowsSheet: SheetStub,
      },
    },
  });
}

function propsOf(
  wrapper: ReturnType<typeof mount>,
  stub: { name: string },
): Record<string, unknown> {
  return wrapper.findComponent(stub).props() as Record<string, unknown>;
}

function hasOrderParts(wrapper: ReturnType<typeof mount>) {
  return [
    OrderItemsTableStub,
    OrderSummaryCardStub,
    OrderAddressesStub,
    SheetStub,
  ].map((stub) => wrapper.findComponent(stub).exists());
}

function summaryRequests() {
  return useFetchMock.mock.calls.filter(
    ([url]) => (typeof url === 'function' ? url() : url) === SUMMARY_URL,
  );
}

function orderRequests() {
  return useFetchMock.mock.calls.filter(
    ([url, options]) =>
      String(url).startsWith('/api/orders/') && options?.immediate !== false,
  );
}

function notFound(): Error {
  return Object.assign(new Error('Order not found'), { statusCode: 404 });
}

beforeEach(() => {
  results.clear();
  useFetchMock.mockClear();
  mockPollFetch.mockReset();
  mockQuery.value = {};
  mockShowIncVat.value = true;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Order confirmation page — placed in the app', () => {
  beforeEach(() => {
    mockQuery.value = { orderId: PUBLIC_ID, orderNumber: '1100' };
  });

  it('never asks for the checkout summary', () => {
    mount();

    expect(summaryRequests()).toEqual([]);
  });

  it('reads the order the portal reads', () => {
    mount();

    expect(orderRequests().map(([url]) => url)).toEqual([ORDER_URL]);
  });

  it('shows the thank-you, the order number and the link at once', () => {
    resultFor(ORDER_URL).error.value = notFound();
    const wrapper = mount();

    expect(propsOf(wrapper, OrderConfirmationStub)).toEqual({
      orderNumber: '1100',
      publicOrderId: PUBLIC_ID,
    });
    expect(hasOrderParts(wrapper)).toEqual([false, false, false, false]);
  });

  it('shows the order with the order page parts once it is readable', () => {
    resultFor(ORDER_URL).data.value = makeOrder();
    const wrapper = mount();

    expect(hasOrderParts(wrapper)).toEqual([true, true, true, true]);
    const table = propsOf(wrapper, OrderItemsTableStub);
    expect(table.items).toEqual([
      expect.objectContaining({
        name: 'Widget Pro',
        quantity: 3,
        unitPriceFormatted: '150,00 kr',
        totalPriceFormatted: '450,00 kr',
      }),
    ]);
    expect(table.itemCount).toBe(1);
    expect(propsOf(wrapper, OrderSummaryCardStub).amounts).toMatchObject({
      subtotal: '450,00 kr',
      tax: '90,00 kr',
      total: '450,00 kr',
    });
    expect(propsOf(wrapper, OrderAddressesStub)).toEqual({
      billingAddress: { company: 'Acme' },
      shippingAddress: { company: 'Warehouse' },
      customerOrderNumber: 'PO-77',
      goodsLabel: 'Dock 4',
      desiredDeliveryDate: undefined,
      paymentMethod: 'Faktura 30 dagar',
    });
  });

  it('labels the inc-VAT line "to pay incl. VAT"', () => {
    resultFor(ORDER_URL).data.value = makeOrder();
    const wrapper = mount();

    expect(propsOf(wrapper, OrderSummaryCardStub).totalIncVatLabel).toBe(
      'common.to_pay_inc_vat',
    );
    expect(propsOf(wrapper, OrderItemsTableStub).totalIncVatLabel).toBe(
      'common.to_pay_inc_vat',
    );
  });

  it('labels the mobile sheet\'s inc-VAT line "to pay incl. VAT"', () => {
    mockShowIncVat.value = false;
    resultFor(ORDER_URL).data.value = makeOrder();
    const totals = propsOf(mount(), SheetStub).totals as { label: string }[];

    expect(totals.at(-1)?.label).toBe('common.to_pay_inc_vat');
  });

  it("formats the discount in the buyer's own locale", () => {
    const order = makeOrder();
    Object.assign(order.order.cart.summary, { fixedAmountDiscountIncVat: 25 });
    resultFor(ORDER_URL).data.value = order;

    expect(propsOf(mount(), OrderSummaryCardStub).amounts).toMatchObject({
      discount: 'SEK\u00a025.00',
    });
  });

  it('follows the VAT choice', () => {
    mockShowIncVat.value = false;
    resultFor(ORDER_URL).data.value = makeOrder();
    const wrapper = mount();

    expect(propsOf(wrapper, OrderItemsTableStub).items).toEqual([
      expect.objectContaining({ unitPriceFormatted: '120,00 kr' }),
    ]);
  });

  it('waits for the order with the cache bypassed, then shows it', async () => {
    resultFor(ORDER_URL).error.value = notFound();
    mockPollFetch.mockRejectedValueOnce(notFound());
    mockPollFetch.mockResolvedValue(makeOrder());
    const wrapper = mount();

    await vi.advanceTimersByTimeAsync(2500);
    expect(hasOrderParts(wrapper)).toEqual([false, false, false, false]);
    await vi.advanceTimersByTimeAsync(2500);

    expect(mockPollFetch.mock.calls).toEqual([
      [ORDER_URL, { cache: 'no-store' }],
      [ORDER_URL, { cache: 'no-store' }],
    ]);
    expect(hasOrderParts(wrapper)).toEqual([true, true, true, true]);

    await vi.advanceTimersByTimeAsync(20000);
    expect(mockPollFetch).toHaveBeenCalledTimes(2);
  });

  it('does not wait when the order is there on the first response', async () => {
    resultFor(ORDER_URL).data.value = makeOrder();
    mount();

    await vi.advanceTimersByTimeAsync(10000);

    expect(mockPollFetch).not.toHaveBeenCalled();
  });

  it('stops at the bound and keeps showing the thank-you', async () => {
    resultFor(ORDER_URL).error.value = notFound();
    mockPollFetch.mockRejectedValue(notFound());
    const wrapper = mount();

    await vi.advanceTimersByTimeAsync(125000);
    const calls = mockPollFetch.mock.calls.length;
    await vi.advanceTimersByTimeAsync(30000);

    expect(mockPollFetch).toHaveBeenCalledTimes(calls);
    expect(wrapper.findComponent(OrderConfirmationStub).exists()).toBe(true);
    expect(hasOrderParts(wrapper)).toEqual([false, false, false, false]);
  });
});

describe('Order confirmation page — no order id', () => {
  it('asks for nothing and waits for nothing', async () => {
    mockQuery.value = {};
    mount();

    await vi.advanceTimersByTimeAsync(10000);

    expect(summaryRequests()).toEqual([]);
    expect(orderRequests()).toEqual([]);
    expect(mockPollFetch).not.toHaveBeenCalled();
  });
});

describe('Order confirmation page — back from hosted checkout', () => {
  it('shows the thank-you header only, and asks for nothing', async () => {
    mockQuery.value = { 'geins-cart': 'cart-123', 'geins-pt': 'KLARNA' };
    const wrapper = mount();

    await vi.advanceTimersByTimeAsync(10000);

    expect(summaryRequests()).toEqual([]);
    expect(orderRequests()).toEqual([]);
    expect(mockPollFetch).not.toHaveBeenCalled();
    expect(wrapper.findComponent(OrderConfirmationStub).exists()).toBe(true);
    expect(hasOrderParts(wrapper)).toEqual([false, false, false, false]);
  });
});
