import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h, Suspense, onErrorCaptured } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { defaultMountOptions } from '../../utils/component';
import type { Quote, QuoteStatus } from '../../../shared/types/quote';
import { makeQuote } from '../../fixtures/quote';

/** The thank-you page after a quote request was sent. */

const { mockData, mockError, mockUseFetch, mockNavigateTo } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref } = require('vue') as typeof import('vue');
  return {
    mockData: ref<{ quote: Quote } | null>(null),
    mockError: ref<Error | null>(null),
    mockUseFetch: vi.fn(),
    mockNavigateTo: vi.fn((..._args: unknown[]) => Promise.resolve()),
  };
});

vi.stubGlobal('definePageMeta', vi.fn());
vi.stubGlobal('navigateTo', mockNavigateTo);
vi.stubGlobal('createError', (opts: { statusCode: number; fatal?: boolean }) =>
  Object.assign(new Error('error'), opts),
);

mockUseFetch.mockImplementation(() => ({
  data: mockData,
  error: mockError,
  pending: { value: false },
  refresh: vi.fn(),
  status: { value: 'success' },
}));
vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: unknown[]) => mockUseFetch(...args),
}));
vi.stubGlobal('useFetch', mockUseFetch);

const route = {
  params: { id: 'q-001' },
  path: '/portal/quotations/q-001/sent',
  query: {},
  hash: '',
  fullPath: '/portal/quotations/q-001/sent',
  name: 'portal-quotations-id-sent',
  matched: [],
  meta: {},
};
vi.stubGlobal('useRoute', () => route);
vi.mock('#app/composables/router', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useRoute: () => route,
  navigateTo: (...args: unknown[]) => mockNavigateTo(...args),
}));

const { default: PortalQuotationSent } =
  await import('../../../app/pages/portal/quotations/[id]/sent.vue');

const VIEW_PATH = '/se/en/portal/quotations/q-001';

const QuoteConfirmationStub = {
  name: 'QuoteConfirmation',
  props: ['kind', 'number', 'quoteNumber', 'quotationPath'],
  template: '<div data-testid="quote-thanks"><slot /></div>',
};
const stub = (name: string, props: string[]) => ({
  name,
  props,
  template: `<div data-testid="${name}" />`,
});
const ItemsStub = stub('PortalQuoteItems', ['items']);
const SummaryStub = stub('PortalQuoteSummary', ['quote', 'shippingNote']);
const BadgeStub = stub('QuoteEstimateBadge', []);
const AddressStub = stub('AddressBlock', [
  'address',
  'label',
  'bare',
  'labelStyle',
  'companyMuted',
]);

async function mountWith(quote: Quote | null) {
  mockData.value = quote ? { quote } : null;
  const captured: Array<Error & { statusCode?: number }> = [];
  const Wrapper = defineComponent({
    setup() {
      onErrorCaptured((err) => {
        captured.push(err as Error & { statusCode?: number });
        return false;
      });
      return () => h(Suspense, null, { default: () => h(PortalQuotationSent) });
    },
  });
  const wrapper = mount(Wrapper, {
    ...defaultMountOptions,
    global: {
      ...defaultMountOptions.global,
      stubs: {
        ...defaultMountOptions.global.stubs,
        QuoteConfirmation: QuoteConfirmationStub,
        PortalQuoteItems: ItemsStub,
        PortalQuoteSummary: SummaryStub,
        AddressBlock: AddressStub,
        QuoteEstimateBadge: BadgeStub,
      },
    },
  });
  await flushPromises();
  return { wrapper, captured };
}

const sent = (overrides: Partial<Quote> = {}) =>
  makeQuote({
    status: 'requested',
    quoteNumber: '2610-2-0007-00',
    billingAddress: { company: 'Acme AB', addressLine1: 'Billing 1' },
    shippingAddress: { company: 'Acme AB', addressLine1: 'Dock 2' },
    ...overrides,
  });

describe('PortalQuotationSent', () => {
  beforeEach(() => {
    mockData.value = null;
    mockError.value = null;
    mockUseFetch.mockClear();
    mockNavigateTo.mockClear();
  });

  it('reads the quotation by id with dedupe: defer', async () => {
    await mountWith(sent());

    const [urlOrFn, options] = mockUseFetch.mock.calls[0]!;
    const url = typeof urlOrFn === 'function' ? urlOrFn() : urlOrFn;
    expect(url).toBe('/api/quotes/q-001');
    expect(options).toMatchObject({ dedupe: 'defer' });
  });

  it('throws a 404 when the quotation cannot be read', async () => {
    mockError.value = new Error('Network error');

    const { captured } = await mountWith(null);

    expect(captured[0]).toMatchObject({ statusCode: 404, fatal: true });
  });

  describe('who gets in', () => {
    it('stays on the page for a sent request', async () => {
      const { wrapper } = await mountWith(sent());

      expect(mockNavigateTo).not.toHaveBeenCalled();
      expect(wrapper.findComponent(QuoteConfirmationStub).exists()).toBe(true);
    });

    it.each<QuoteStatus>([
      'request_draft',
      'pending',
      'accepted',
      'confirmed',
      'finalized',
      'rejected',
      'canceled',
      'expired',
      'unknown',
    ])('sends a %s quotation to the quotation view', async (status) => {
      const { wrapper } = await mountWith(sent({ status }));

      expect(mockNavigateTo).toHaveBeenCalledWith(VIEW_PATH, { replace: true });
      expect(wrapper.findComponent(QuoteConfirmationStub).exists()).toBe(false);
    });
  });

  describe('what it shows', () => {
    it('heads the page with the request card and its number', async () => {
      const { wrapper } = await mountWith(sent());

      expect(wrapper.findComponent(QuoteConfirmationStub).props()).toEqual({
        kind: 'request',
        number: '2610-2-0007-00',
        quoteNumber: undefined,
        quotationPath: VIEW_PATH,
      });
    });

    it("lists the request's lines under their heading", async () => {
      const quote = sent();
      const { wrapper } = await mountWith(quote);

      const contents = wrapper.find('[data-testid="quote-thanks-contents"]');
      expect(contents.find('h3').text()).toBe(
        'portal.quotations.confirm.request_lines',
      );
      expect(wrapper.findComponent(ItemsStub).props('items')).toEqual(
        quote.lineItems,
      );
    });

    it('titles the summary and marks it as an estimate', async () => {
      const { wrapper } = await mountWith(sent());

      const summary = wrapper.find('[data-testid="quote-thanks-summary"]');
      expect(summary.text()).toContain(
        'portal.quotations.request.summary_title',
      );
      // The same badge and note as on the request page.
      expect(summary.findComponent(BadgeStub).exists()).toBe(true);
    });

    it('sums it up with the shipping marked as an estimate', async () => {
      const quote = sent();
      const { wrapper } = await mountWith(quote);

      expect(wrapper.findComponent(SummaryStub).props()).toEqual({
        quote,
        shippingNote: 'portal.quotations.request.shipping_note',
      });
    });

    it('shows the invoice and delivery addresses', async () => {
      const { wrapper } = await mountWith(sent());

      const blocks = wrapper.findAllComponents(AddressStub);
      expect(blocks.map((block) => block.props('label'))).toEqual([
        'portal.quotations.invoice_address',
        'portal.quotations.delivery_address',
      ]);
      expect(blocks.map((block) => block.props('address'))).toEqual([
        { company: 'Acme AB', addressLine1: 'Billing 1' },
        { company: 'Acme AB', addressLine1: 'Dock 2' },
      ]);
    });

    it('leaves the address box out without addresses', async () => {
      const { wrapper } = await mountWith(
        sent({ billingAddress: undefined, shippingAddress: undefined }),
      );

      expect(
        wrapper.find('[data-testid="quote-thanks-addresses"]').exists(),
      ).toBe(false);
    });
  });
});
