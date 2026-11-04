import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  defineComponent,
  h,
  ref,
  Suspense,
  onErrorCaptured,
  type Ref,
} from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { defaultMountOptions } from '../../utils/component';
import type { Quote, QuoteStatus } from '../../../shared/types/quote';
import { makeQuote } from '../../fixtures/quote';

/**
 * The thank-you page after an order was placed from a quotation. The order is
 * read by the number on the quotation, and waited for like on the order
 * confirmation: a fresh order is readable only after some seconds.
 */

type FetchResult = {
  data: Ref<unknown>;
  pending: Ref<boolean>;
  error: Ref<Error | null>;
};

const { results, mockUseFetch, mockNavigateTo, mockPollFetch } = vi.hoisted(
  () => ({
    results: new Map<string, FetchResult>(),
    mockUseFetch: vi.fn(),
    mockNavigateTo: vi.fn((..._args: unknown[]) => Promise.resolve()),
    mockPollFetch: vi.fn(),
  }),
);

function resultFor(url: string): FetchResult {
  let result = results.get(url);
  if (!result) {
    result = { data: ref(null), pending: ref(false), error: ref(null) };
    results.set(url, result);
  }
  return result;
}

mockUseFetch.mockImplementation(
  (url: string | (() => string), _options?: Record<string, unknown>) =>
    resultFor(typeof url === 'function' ? url() : url),
);

vi.stubGlobal('definePageMeta', vi.fn());
vi.stubGlobal('navigateTo', mockNavigateTo);
vi.stubGlobal('createError', (opts: { statusCode: number; fatal?: boolean }) =>
  Object.assign(new Error('error'), opts),
);
vi.stubGlobal('$fetch', (...args: unknown[]) => mockPollFetch(...args));
vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: unknown[]) => mockUseFetch(...args),
}));
vi.stubGlobal('useFetch', mockUseFetch);

const route = {
  params: { id: 'q-001' },
  path: '/portal/quotations/q-001/ordered',
  query: {},
  hash: '',
  fullPath: '/portal/quotations/q-001/ordered',
  name: 'portal-quotations-id-ordered',
  matched: [],
  meta: {},
};
vi.stubGlobal('useRoute', () => route);
vi.mock('#app/composables/router', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useRoute: () => route,
  navigateTo: (...args: unknown[]) => mockNavigateTo(...args),
}));

const { default: PortalQuotationOrdered } =
  await import('../../../app/pages/portal/quotations/[id]/ordered.vue');

const VIEW_PATH = '/se/en/portal/quotations/q-001';
const QUOTE_URL = '/api/quotes/q-001';
const ORDER_URL = '/api/orders/by-number/1155';
const PUBLIC_ID = '8dd16643-aaaa-bbbb-cccc-000000000000';

const QuoteConfirmationStub = {
  name: 'QuoteConfirmation',
  props: ['kind', 'number', 'quoteNumber', 'quotationPath'],
  template: '<div data-testid="quote-thanks"><slot /></div>',
};
const ConfirmedOrderStub = {
  name: 'ConfirmedOrder',
  props: ['order', 'publicOrderId', 'paymentTerms'],
  template: '<div data-testid="confirmed-order" />',
};

const ORDER = { id: 1155, publicId: PUBLIC_ID, cart: { items: [] } };

const ordered = (overrides: Partial<Quote> = {}) =>
  makeQuote({
    status: 'finalized',
    quoteNumber: '2610-2-0011-00',
    orderId: '1155',
    ...overrides,
  });

async function mountWith(quote: Quote | null) {
  resultFor(QUOTE_URL).data.value = quote ? { quote } : null;
  const captured: Array<Error & { statusCode?: number }> = [];
  const Wrapper = defineComponent({
    setup() {
      onErrorCaptured((err) => {
        captured.push(err as Error & { statusCode?: number });
        return false;
      });
      return () =>
        h(Suspense, null, { default: () => h(PortalQuotationOrdered) });
    },
  });
  const wrapper = mount(Wrapper, {
    ...defaultMountOptions,
    global: {
      ...defaultMountOptions.global,
      stubs: {
        ...defaultMountOptions.global.stubs,
        QuoteConfirmation: QuoteConfirmationStub,
        ConfirmedOrder: ConfirmedOrderStub,
      },
    },
  });
  await flushPromises();
  return { wrapper, captured };
}

function notFound(): Error {
  return Object.assign(new Error('Order not found'), { statusCode: 404 });
}

/** The order reads the page asked for at once, not the polls. */
function orderRequests() {
  return mockUseFetch.mock.calls.filter(
    ([url, options]) =>
      String(typeof url === 'function' ? url() : url).startsWith(
        '/api/orders/',
      ) && options?.immediate !== false,
  );
}

const loading = (wrapper: Awaited<ReturnType<typeof mountWith>>['wrapper']) =>
  wrapper.find('[data-testid="confirmation-order-loading"]');
const slow = (wrapper: Awaited<ReturnType<typeof mountWith>>['wrapper']) =>
  wrapper.find('[data-testid="confirmation-order-slow"]');

describe('PortalQuotationOrdered', () => {
  beforeEach(() => {
    results.clear();
    mockUseFetch.mockClear();
    mockNavigateTo.mockClear();
    mockPollFetch.mockReset();
    // Only the poll's interval and clock: flushPromises needs setImmediate.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the quotation by id with dedupe: defer', async () => {
    await mountWith(ordered());

    const [urlOrFn, options] = mockUseFetch.mock.calls[0]!;
    const url = typeof urlOrFn === 'function' ? urlOrFn() : urlOrFn;
    expect(url).toBe(QUOTE_URL);
    expect(options).toMatchObject({ dedupe: 'defer' });
  });

  it('throws a 404 when the quotation cannot be read', async () => {
    resultFor(QUOTE_URL).error.value = new Error('Network error');

    const { captured } = await mountWith(null);

    expect(captured[0]).toMatchObject({ statusCode: 404, fatal: true });
  });

  describe('who gets in', () => {
    it('stays on the page for a finalized quotation', async () => {
      const { wrapper } = await mountWith(ordered());

      expect(mockNavigateTo).not.toHaveBeenCalled();
      expect(wrapper.findComponent(QuoteConfirmationStub).exists()).toBe(true);
    });

    it.each<QuoteStatus>([
      'request_draft',
      'requested',
      'pending',
      'accepted',
      'confirmed',
      'rejected',
      'canceled',
      'expired',
      'unknown',
    ])(
      'sends a %s quotation to the quotation view, reading no order',
      async (status) => {
        const { wrapper } = await mountWith(
          ordered({ status, orderId: undefined }),
        );

        expect(mockNavigateTo).toHaveBeenCalledWith(VIEW_PATH, {
          replace: true,
        });
        expect(wrapper.findComponent(QuoteConfirmationStub).exists()).toBe(
          false,
        );
        expect(orderRequests()).toEqual([]);
      },
    );

    it('sends a finalized quotation without an order number to the view', async () => {
      const { wrapper } = await mountWith(ordered({ orderId: undefined }));

      expect(mockNavigateTo).toHaveBeenCalledWith(VIEW_PATH, { replace: true });
      expect(wrapper.findComponent(QuoteConfirmationStub).exists()).toBe(false);
      expect(orderRequests()).toEqual([]);
    });
  });

  describe('what it shows', () => {
    it('heads the page with the order card, its number and the quotation', async () => {
      const { wrapper } = await mountWith(ordered());

      expect(wrapper.findComponent(QuoteConfirmationStub).props()).toEqual({
        kind: 'order',
        number: '1155',
        quoteNumber: '2610-2-0011-00',
        quotationPath: VIEW_PATH,
      });
    });

    it('reads the order by the number on the quotation', async () => {
      await mountWith(ordered());

      expect(orderRequests().map(([url]) => url)).toEqual([ORDER_URL]);
      expect(orderRequests()[0]![1]).toMatchObject({ dedupe: 'defer' });
    });

    it("shows the order with the order confirmation's parts", async () => {
      resultFor(ORDER_URL).data.value = { order: ORDER };

      const { wrapper } = await mountWith(ordered());

      expect(wrapper.findComponent(ConfirmedOrderStub).props()).toEqual({
        order: ORDER,
        publicOrderId: PUBLIC_ID,
        paymentTerms: 'Net 30',
      });
      expect(loading(wrapper).exists()).toBe(false);
    });
  });

  it("hands the quotation's payment terms to the order, which has none", async () => {
    resultFor(ORDER_URL).data.value = { order: ORDER };

    const { wrapper } = await mountWith(
      ordered({ paymentTerms: '30 dagar netto' }),
    );

    expect(
      wrapper.findComponent(ConfirmedOrderStub).props('paymentTerms'),
    ).toBe('30 dagar netto');
  });

  describe('while the order is awaited', () => {
    it('says it is fetching the order, as a status', async () => {
      resultFor(ORDER_URL).error.value = notFound();

      const { wrapper } = await mountWith(ordered());

      expect(loading(wrapper).attributes('role')).toBe('status');
      expect(loading(wrapper).text()).toBe('common.fetching_order');
      expect(wrapper.findComponent(ConfirmedOrderStub).exists()).toBe(false);
    });

    it('waits for the order with the cache bypassed, then shows it', async () => {
      resultFor(ORDER_URL).error.value = notFound();
      mockPollFetch.mockRejectedValueOnce(notFound());
      mockPollFetch.mockResolvedValue({ order: ORDER });
      const { wrapper } = await mountWith(ordered());

      await vi.advanceTimersByTimeAsync(2500);
      expect(wrapper.findComponent(ConfirmedOrderStub).exists()).toBe(false);
      await vi.advanceTimersByTimeAsync(2500);

      expect(mockPollFetch.mock.calls).toEqual([
        [ORDER_URL, { cache: 'no-store' }],
        [ORDER_URL, { cache: 'no-store' }],
      ]);
      expect(wrapper.findComponent(ConfirmedOrderStub).exists()).toBe(true);
      expect(loading(wrapper).exists()).toBe(false);
    });

    it('does not wait when the order is there on the first response', async () => {
      resultFor(ORDER_URL).data.value = { order: ORDER };
      await mountWith(ordered());

      await vi.advanceTimersByTimeAsync(10000);

      expect(mockPollFetch).not.toHaveBeenCalled();
    });

    it('at the bound, says the order is slow and keeps the card', async () => {
      resultFor(ORDER_URL).error.value = notFound();
      mockPollFetch.mockRejectedValue(notFound());
      const { wrapper } = await mountWith(ordered());

      await vi.advanceTimersByTimeAsync(115000);
      expect(loading(wrapper).exists()).toBe(true);
      expect(slow(wrapper).exists()).toBe(false);

      await vi.advanceTimersByTimeAsync(10000);

      expect(loading(wrapper).exists()).toBe(false);
      expect(slow(wrapper).attributes('role')).toBe('status');
      expect(slow(wrapper).text()).toBe('order_confirmation.order_slow');
      expect(wrapper.findComponent(QuoteConfirmationStub).exists()).toBe(true);
    });
  });
});
