import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, type Ref } from 'vue';
import { mountComponent } from '../../utils/component';

/**
 * The confirmation page, both ways a buyer lands on it.
 *
 * In-app (`?orderId=<publicId>&orderNumber=<id>`, from checkout.vue): the page
 * reads the order the portal reads and waits for it, because Geins's checkout
 * summary never carries an order placed through `createOrder`.
 *
 * Hosted (`?geins-cart=…&geins-pt=…`, Geins's redirect): the checkout summary,
 * with the payment type Geins itself put on the URL.
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
      cart: {
        items: [
          {
            product: { name: 'Widget Pro', articleNumber: 'ART-001' },
            quantity: 3,
            unitPrice: { sellingPriceExVatFormatted: '120,00 kr' },
            totalPrice: { sellingPriceExVatFormatted: '360,00 kr' },
          },
        ],
        summary: {},
      },
      paymentDetails: [{ displayName: 'Faktura 30 dagar' }],
    },
  };
}

const OrderConfirmationStub = {
  name: 'OrderConfirmation',
  props: [
    'summary',
    'isLoading',
    'paymentLabel',
    'reference',
    'orderNumber',
    'publicOrderId',
  ],
  template: '<div data-testid="order-confirmation" />',
};

function mount() {
  return mountComponent(ConfirmationPage, {
    global: { stubs: { OrderConfirmation: OrderConfirmationStub } },
  });
}

function confirmationProps(wrapper: ReturnType<typeof mount>) {
  return wrapper.findComponent(OrderConfirmationStub).props() as Record<
    string,
    unknown
  >;
}

function summaryRequests() {
  return useFetchMock.mock.calls.filter(
    ([url, options]) =>
      (typeof url === 'function' ? url() : url) === SUMMARY_URL &&
      options?.immediate !== false,
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

    expect(
      useFetchMock.mock.calls.some(
        ([url, options]) => url === ORDER_URL && options?.immediate !== false,
      ),
    ).toBe(true);
  });

  it('shows the thank-you, the order number and the link at once', () => {
    resultFor(ORDER_URL).error.value = notFound();
    const props = confirmationProps(mount());

    expect(props.isLoading).toBe(false);
    expect(props.summary).toBeNull();
    expect(props.orderNumber).toBe('1100');
    expect(props.publicOrderId).toBe(PUBLIC_ID);
  });

  it('fills in the order once it is readable', () => {
    resultFor(ORDER_URL).data.value = makeOrder();
    const props = confirmationProps(mount());
    const summary = props.summary as { orderId: string; rows: unknown[] };

    expect(summary.orderId).toBe('1100');
    expect(summary.rows).toHaveLength(1);
    expect(props.reference).toBe('PO-77');
    expect(props.paymentLabel).toBe('Faktura 30 dagar');
  });

  it('has no payment label until the order says what it is', () => {
    resultFor(ORDER_URL).error.value = notFound();

    expect(confirmationProps(mount()).paymentLabel).toBeUndefined();
  });

  it('waits for the order with the cache bypassed, then renders it', async () => {
    resultFor(ORDER_URL).error.value = notFound();
    mockPollFetch.mockRejectedValueOnce(notFound());
    mockPollFetch.mockResolvedValue(makeOrder());
    const wrapper = mount();

    await vi.advanceTimersByTimeAsync(2500);
    expect(confirmationProps(wrapper).summary).toBeNull();
    await vi.advanceTimersByTimeAsync(2500);

    expect(mockPollFetch.mock.calls).toEqual([
      [ORDER_URL, { cache: 'no-store' }],
      [ORDER_URL, { cache: 'no-store' }],
    ]);
    const summary = confirmationProps(wrapper).summary as { rows: unknown[] };
    expect(summary.rows).toHaveLength(1);

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
    expect(confirmationProps(wrapper).summary).toBeNull();
  });
});

describe('Order confirmation page — no order id', () => {
  it('asks for nothing and waits for nothing', async () => {
    mockQuery.value = {};
    mount();

    await vi.advanceTimersByTimeAsync(10000);

    expect(summaryRequests()).toEqual([]);
    expect(
      useFetchMock.mock.calls.some(
        ([url, options]) =>
          String(url).startsWith('/api/orders/') &&
          options?.immediate !== false,
      ),
    ).toBe(false);
    expect(mockPollFetch).not.toHaveBeenCalled();
  });
});

describe('Order confirmation page — back from hosted checkout', () => {
  const CART_ID = 'cart-123';

  it('asks for the summary with the payment type Geins put on the URL', () => {
    mockQuery.value = { 'geins-cart': CART_ID, 'geins-pt': 'KLARNA' };
    mount();

    const [call] = summaryRequests();
    expect(call?.[1]?.query).toEqual({
      orderId: CART_ID,
      paymentMethod: 'KLARNA',
    });
  });

  it('labels the payment by that type', () => {
    mockQuery.value = { 'geins-cart': CART_ID, 'geins-pt': 'STANDARD' };

    expect(confirmationProps(mount()).paymentLabel).toBe(
      'checkout.payment_types.invoice',
    );
  });

  it('asks for no summary without a payment type, and never guesses one', () => {
    mockQuery.value = { 'geins-cart': CART_ID };
    const props = confirmationProps(mount());

    expect(summaryRequests()).toEqual([]);
    expect(props.paymentLabel).toBeUndefined();
    expect(JSON.stringify(useFetchMock.mock.calls)).not.toContain('invoice');
  });

  it('does not read or wait for an order by the cart id', async () => {
    mockQuery.value = { 'geins-cart': CART_ID, 'geins-pt': 'KLARNA' };
    mount();

    await vi.advanceTimersByTimeAsync(10000);

    expect(
      useFetchMock.mock.calls.some(
        ([url, options]) =>
          String(url).startsWith('/api/orders/') &&
          options?.immediate !== false,
      ),
    ).toBe(false);
    expect(mockPollFetch).not.toHaveBeenCalled();
  });

  it('renders the summary it gets', () => {
    mockQuery.value = { 'geins-cart': CART_ID, 'geins-pt': 'KLARNA' };
    resultFor(SUMMARY_URL).data.value = { order: { orderId: '55' } };

    expect(confirmationProps(mount()).summary).toEqual({ orderId: '55' });
  });
});
