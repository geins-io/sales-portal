import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h, Suspense, onErrorCaptured } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { defaultMountOptions } from '../../utils/component';
import type { Quote, QuoteStatus } from '../../../shared/types/quote';
import { makeQuote } from '../../fixtures/quote';
import { mockShowIncVat } from '../../setup-components';
import { quoteRows } from '../../../app/utils/quote-view';

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
// The order page's parts, as the order confirmation uses them. Typed props:
// `show-prices` is a boolean attribute, which an array-props stub reads as ''.
const partProps = {
  items: Array,
  rows: Array,
  totals: Array,
  showPrices: Boolean,
  title: String,
  triggerLabel: String,
};
const TableStub = {
  name: 'OrderItemsTable',
  props: partProps,
  template: '<div data-testid="OrderItemsTable" />',
};
const CardStub = {
  name: 'OrderSummaryCard',
  props: partProps,
  template:
    '<div data-testid="OrderSummaryCard"><slot name="heading-aside" /><slot /></div>',
};
const SheetStub = {
  name: 'PortalItemRowsSheet',
  props: partProps,
  template: '<div data-testid="PortalItemRowsSheet" />',
};
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
        OrderItemsTable: TableStub,
        OrderSummaryCard: CardStub,
        PortalItemRowsSheet: SheetStub,
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

    type Row = { key: string; label: string; value?: string };
    const valueOf = (rows: Row[], key: string) =>
      rows.find((row) => row.key === key)?.value;

    it("lists the request's lines in the order table, under their heading, from lg", async () => {
      mockShowIncVat.value = true;
      const quote = sent();
      const { wrapper } = await mountWith(quote);

      const table = wrapper.findComponent(TableStub);
      expect(table.props('items')).toEqual(quoteRows(quote, true));
      expect(table.props('title')).toBe(
        'portal.quotations.confirm.request_lines',
      );
      expect(table.props('showPrices')).toBe(true);
      expect(table.element.parentElement?.classList).toContain('lg:block');
      expect(table.element.parentElement?.classList).toContain('hidden');
    });

    it('titles the summary card and marks it as an estimate inside it', async () => {
      const { wrapper } = await mountWith(sent());

      const card = wrapper.findComponent(CardStub);
      expect(card.props('title')).toBe(
        'portal.quotations.request.summary_title',
      );
      expect(card.props('showPrices')).toBe(true);
      // The same badge and note as on the request page.
      expect(card.findComponent(BadgeStub).exists()).toBe(true);
    });

    it('sums it up like the order summary, with the shipping marked as an estimate', async () => {
      mockShowIncVat.value = true;
      const { wrapper } = await mountWith(sent());

      const rows = wrapper.findComponent(CardStub).props('rows') as Row[];
      expect(rows.map((row) => row.key)).toEqual([
        'subtotal',
        'shipping',
        'tax',
        'total',
      ]);
      expect(valueOf(rows, 'shipping')).toBe(
        'portal.quotations.request.shipping_note',
      );
      expect(valueOf(rows, 'total')).toBe('250,00 kr');
    });

    it('repeats the rows under the table and in the sheet', async () => {
      const { wrapper } = await mountWith(sent());

      const rows = wrapper.findComponent(CardStub).props('rows');
      expect(wrapper.findComponent(TableStub).props('rows')).toEqual(rows);
      expect(wrapper.findComponent(SheetStub).props('totals')).toEqual(rows);
    });

    it('puts the lines behind "show items" below lg, right under the summary', async () => {
      mockShowIncVat.value = false;
      const quote = sent();
      const { wrapper } = await mountWith(quote);

      const sheet = wrapper.findComponent(SheetStub);
      expect(sheet.props()).toEqual(
        expect.objectContaining({
          items: quoteRows(quote, false),
          triggerLabel: 'portal.quotations.view_items',
          title: 'portal.quotations.confirm.request_lines',
          showPrices: true,
        }),
      );
      expect(sheet.classes()).toContain('lg:hidden');
      expect(wrapper.findComponent(CardStub).element.nextElementSibling).toBe(
        sheet.element,
      );
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
