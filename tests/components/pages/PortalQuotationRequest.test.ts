import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h, ref, Suspense, onErrorCaptured } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { defaultMountOptions } from '../../utils/component';
import type {
  Quote,
  QuoteRequestDetails,
  QuoteStatus,
} from '../../../shared/types/quote';
import type { Company } from '../../../shared/types/company';
import { makeQuote } from '../../fixtures/quote';
import { mockShowIncVat } from '../../setup-components';

// The shared mock fills `{name}` placeholders, and keys carry none; this one
// appends the values so the title can be checked.
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${Object.values(params).join(' ')}` : key,
    locale: ref('en'),
  }),
}));

const {
  mockQuoteData,
  mockQuoteError,
  mockCompanyData,
  mockUseFetch,
  mockNavigateTo,
  mockSendQuoteRequest,
  mockIsActionLoading,
  mockStoreError,
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref } = require('vue') as typeof import('vue');
  return {
    mockQuoteData: ref<{ quote: Quote } | null>(null),
    mockQuoteError: ref<Error | null>(null),
    mockCompanyData: ref<{ company: Company } | null>(null),
    mockUseFetch: vi.fn(),
    mockNavigateTo: vi.fn((..._args: unknown[]) => Promise.resolve()),
    mockSendQuoteRequest: vi.fn(
      (_id: string, _details: QuoteRequestDetails): Promise<Quote | null> =>
        Promise.resolve(null),
    ),
    mockIsActionLoading: ref(false),
    mockStoreError: ref<string | null>(null),
  };
});

vi.stubGlobal('definePageMeta', vi.fn());
vi.stubGlobal('navigateTo', mockNavigateTo);
vi.stubGlobal('createError', (opts: { statusCode: number; fatal?: boolean }) =>
  Object.assign(new Error('error'), opts),
);

mockUseFetch.mockImplementation((urlOrFn: string | (() => string)) => {
  const url = typeof urlOrFn === 'function' ? urlOrFn() : urlOrFn;
  const company = url === '/api/portal/company';
  return {
    data: company ? mockCompanyData : mockQuoteData,
    error: company ? ref(null) : mockQuoteError,
    pending: { value: false },
    refresh: vi.fn(),
    status: { value: 'success' },
  };
});
vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: unknown[]) => mockUseFetch(...args),
}));
vi.stubGlobal('useFetch', mockUseFetch);

const route = {
  params: { id: 'q-001' },
  path: '/portal/quotations/q-001/request',
  query: {},
  hash: '',
  fullPath: '/portal/quotations/q-001/request',
  name: 'portal-quotations-id-request',
  matched: [],
  meta: {},
};
vi.stubGlobal('useRoute', () => route);
vi.mock('#app/composables/router', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useRoute: () => route,
  navigateTo: (...args: unknown[]) => mockNavigateTo(...args),
}));

vi.mock('../../../app/stores/quotes', () => ({
  useQuotesStore: () => ({
    get isActionLoading() {
      return mockIsActionLoading.value;
    },
    get error() {
      return mockStoreError.value;
    },
    set error(value: string | null) {
      mockStoreError.value = value;
    },
    sendQuoteRequest: (id: string, details: QuoteRequestDetails) =>
      mockSendQuoteRequest(id, details),
  }),
}));

const { default: PortalQuotationRequest } =
  await import('../../../app/pages/portal/quotations/[id]/request.vue');

const VIEW_PATH = '/se/en/portal/quotations/q-001';

const stubs = {
  ProductThumbnail: { template: '<span />' },
  GeinsImage: { template: '<img />' },
};

function makeCompany(): Company {
  return {
    id: 'company-001',
    name: 'Acme AB',
    vatNumber: 'SE556000000101',
    exVat: true,
    limitedProductAccess: false,
    addresses: [
      {
        addressId: 'addr-1',
        companyId: 'company-001',
        email: 'billing@acme.com',
        phone: '',
        company: 'Acme AB',
        firstName: 'Jane',
        lastName: 'Doe',
        careOf: null,
        addressLine1: 'Dock 2',
        addressLine2: null,
        addressLine3: null,
        zip: '11122',
        city: 'Stockholm',
        region: null,
        country: 'SE',
        addressType: 'delivery',
        addressReferenceId: null,
      },
    ],
    buyers: [],
  };
}

async function mountPage() {
  const captured: Array<Error & { statusCode?: number }> = [];
  const Wrapper = defineComponent({
    setup() {
      onErrorCaptured((err) => {
        captured.push(err as Error & { statusCode?: number });
        return false;
      });
      return () =>
        h(Suspense, null, { default: () => h(PortalQuotationRequest) });
    },
  });
  const wrapper = mount(Wrapper, {
    ...defaultMountOptions,
    global: {
      ...defaultMountOptions.global,
      stubs: { ...defaultMountOptions.global.stubs, ...stubs },
    },
  });
  await flushPromises();
  return { wrapper, captured };
}

async function mountWith(quote: Quote) {
  mockQuoteData.value = { quote };
  return (await mountPage()).wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountWith>>;

const draft = (overrides: Partial<Quote> = {}) =>
  makeQuote({ status: 'request_draft', name: 'Spring restock', ...overrides });

const sendButton = (wrapper: Wrapper) =>
  wrapper.find('[data-testid="place-order-button"]');

async function send(wrapper: Wrapper) {
  await sendButton(wrapper).trigger('click');
  await flushPromises();
}

// The popover renders into document.body, outside the wrapper.
const estimateNote = () =>
  document.body.querySelector('[data-testid="quote-estimate-note"]');

describe('PortalQuotationRequest', () => {
  beforeEach(() => {
    mockQuoteData.value = null;
    mockQuoteError.value = null;
    mockCompanyData.value = { company: makeCompany() };
    mockIsActionLoading.value = false;
    mockStoreError.value = null;
    mockUseFetch.mockClear();
    mockNavigateTo.mockClear();
    mockSendQuoteRequest.mockReset();
    mockSendQuoteRequest.mockResolvedValue(null);
    mockShowIncVat.value = false;
  });

  it('reads the quotation and the company with dedupe: defer', async () => {
    await mountWith(draft());

    const urls = mockUseFetch.mock.calls.map(([urlOrFn, options]) => [
      typeof urlOrFn === 'function' ? urlOrFn() : urlOrFn,
      options,
    ]);
    expect(urls).toEqual([
      ['/api/quotes/q-001', expect.objectContaining({ dedupe: 'defer' })],
      ['/api/portal/company', expect.objectContaining({ dedupe: 'defer' })],
    ]);
  });

  it('throws a 404 when the quotation cannot be read', async () => {
    mockQuoteError.value = new Error('Network error');

    const { captured } = await mountPage();

    expect(captured[0]).toMatchObject({ statusCode: 404, fatal: true });
  });

  describe('who gets in', () => {
    it('stays on the page for a request draft', async () => {
      const wrapper = await mountWith(draft());

      expect(mockNavigateTo).not.toHaveBeenCalled();
      expect(wrapper.find('[data-testid="quote-request-page"]').exists()).toBe(
        true,
      );
    });

    it.each<QuoteStatus>([
      'requested',
      'pending',
      'accepted',
      'confirmed',
      'finalized',
      'rejected',
      'canceled',
      'expired',
      'unknown',
    ])('sends a %s quotation to the quotation view', async (status) => {
      const wrapper = await mountWith(draft({ status }));

      expect(mockNavigateTo).toHaveBeenCalledWith(VIEW_PATH, { replace: true });
      expect(wrapper.find('[data-testid="quote-request-page"]').exists()).toBe(
        false,
      );
    });

    it('does not read the company for a quotation it sends away', async () => {
      await mountWith(draft({ status: 'requested' }));

      const urls = mockUseFetch.mock.calls.map(([urlOrFn]) =>
        typeof urlOrFn === 'function' ? urlOrFn() : urlOrFn,
      );
      expect(urls).toEqual(['/api/quotes/q-001']);
    });
  });

  describe('what is shown', () => {
    it('links back to the draft view', async () => {
      const wrapper = await mountWith(draft());

      expect(
        wrapper.find('[data-testid="quote-request-back"]').attributes('href'),
      ).toBe(VIEW_PATH);
    });

    it('says that no order is placed', async () => {
      const wrapper = await mountWith(draft());

      expect(
        wrapper.find('[data-testid="quote-request-banner"]').text(),
      ).toContain('portal.quotations.request.banner_title');
    });

    it("titles the page with the draft's name", async () => {
      const wrapper = await mountWith(draft());

      expect(
        wrapper.find('[data-testid="quote-request-title"]').text(),
      ).toContain('Spring restock');
    });

    it('titles a draft without a name with its number', async () => {
      const wrapper = await mountWith(draft({ name: undefined }));

      expect(
        wrapper.find('[data-testid="quote-request-title"]').text(),
      ).toContain('#QUO-2026-001');
    });

    it('lists the lines in the read-only "Artiklar" table', async () => {
      const wrapper = await mountWith(draft());

      const articles = wrapper.find('[data-testid="quote-articles"]');
      expect(articles.text()).toContain('portal.quotations.items_heading');
      expect(articles.findAll('[data-testid="line-item-row"]')).toHaveLength(1);
      expect(articles.find('[data-testid="line-item-row"]').text()).toContain(
        'Widget Pro',
      );
      expect(articles.find('input').exists()).toBe(false);
    });

    it("labels the desired date with the request's text", async () => {
      const wrapper = await mountWith(draft());

      const delivery = wrapper.find('[data-testid="checkout-delivery-info"]');
      expect(delivery.text()).toContain(
        'portal.quotations.request.desired_date',
      );
      expect(delivery.text()).toContain(
        'portal.quotations.request.desired_date_help',
      );
      expect(delivery.text()).not.toContain('checkout.desired_delivery_date');
    });

    it('shows the company and its delivery address', async () => {
      const wrapper = await mountWith(draft());

      expect(
        wrapper.find('[data-testid="checkout-company-info"]').text(),
      ).toContain('Acme AB');
      expect(wrapper.find('[data-testid="delivery-address"]').text()).toContain(
        'Dock 2',
      );
    });

    it('leaves the company and delivery cards out without a company', async () => {
      mockCompanyData.value = null;

      const wrapper = await mountWith(draft());

      expect(
        wrapper.find('[data-testid="checkout-company-info"]').exists(),
      ).toBe(false);
      expect(
        wrapper.find('[data-testid="checkout-delivery-info"]').exists(),
      ).toBe(false);
      expect(
        wrapper.find('[data-testid="quote-request-message"]').exists(),
      ).toBe(true);
    });

    it('says where the reference shows', async () => {
      const wrapper = await mountWith(draft());

      expect(
        wrapper
          .find('[data-testid="checkout-customer-order-number-help"]')
          .text(),
      ).toBe('portal.quotations.request.reference_help');
    });

    it('marks the summary as an estimate', async () => {
      const wrapper = await mountWith(draft());

      const badge = wrapper.find(
        '[data-testid="checkout-summary-heading"] [data-testid="quote-estimate-badge"]',
      );
      expect(badge.text()).toContain(
        'portal.quotations.request.estimate_badge',
      );
      expect(badge.attributes('aria-expanded')).toBe('false');
      expect(estimateNote()).toBeNull();
    });

    // Staying open and closing are checked in the browser: happy-dom moves
    // focus so the dismiss layer closes it again on the next flush.
    it('opens the estimate note on click', async () => {
      const wrapper = await mountWith(draft());
      const badge = wrapper.find('[data-testid="quote-estimate-badge"]');

      await badge.trigger('click');
      expect(badge.attributes('aria-expanded')).toBe('true');
      expect(estimateNote()?.textContent).toContain(
        'portal.quotations.request.estimate_note',
      );
      wrapper.unmount();
    });

    it('calls the inc-VAT line a total, not a payment', async () => {
      const wrapper = await mountWith(draft());

      const line = wrapper.find('[data-testid="checkout-summary-to-pay"]');
      expect(line.text()).toContain('common.total_inc_vat');
      expect(line.text()).not.toContain('common.to_pay_inc_vat');
    });

    it('labels the message field', async () => {
      const wrapper = await mountWith(draft());

      const label = wrapper.find('label[for="quote-request-message"]');
      expect(label.text()).toBe('portal.quotations.request.comment');
      expect(
        wrapper.find('[data-testid="quote-request-message"]').attributes('id'),
      ).toBe('quote-request-message');
    });

    it('has the goods label beside the desired date', async () => {
      const wrapper = await mountWith(draft());

      const delivery = wrapper.find('[data-testid="checkout-delivery-info"]');
      expect(
        delivery.find('[data-testid="checkout-goods-label"]').exists(),
      ).toBe(true);
      expect(delivery.find('label[for="checkout-goods-label"]').text()).toBe(
        'checkout.goods_label',
      );
    });

    it('caps the PO number at 30, the goods label at 500 and the message at 2000 characters', async () => {
      const wrapper = await mountWith(draft());

      expect(
        wrapper
          .find('[data-testid="checkout-customer-order-number"]')
          .attributes('maxlength'),
      ).toBe('30');
      expect(
        wrapper
          .find('[data-testid="checkout-goods-label"]')
          .attributes('maxlength'),
      ).toBe('500');
      expect(
        wrapper
          .find('[data-testid="quote-request-message"]')
          .attributes('maxlength'),
      ).toBe('2000');
    });

    it('counts the message characters', async () => {
      const wrapper = await mountWith(draft());

      await wrapper
        .find('[data-testid="quote-request-message"]')
        .setValue('Hej säljare');

      expect(
        wrapper.find('[data-testid="quote-request-message-count"]').text(),
      ).toBe('11 / 2000');
    });

    it('sums the summary from the quotation, with no terms box', async () => {
      const wrapper = await mountWith(draft());

      const summary = wrapper.find('[data-testid="checkout-order-summary"]');
      expect(summary.find('h2').text()).toBe(
        'portal.quotations.request.summary_title',
      );
      expect(
        summary.find('[data-testid="checkout-summary-subtotal"]').text(),
      ).toBe('160,00 kr');
      expect(
        summary.find('[data-testid="checkout-summary-shipping"]').text(),
      ).toBe('portal.quotations.request.shipping_note');
      expect(
        sendButton(wrapper).find('[data-testid="place-order-icon"]').exists(),
      ).toBe(true);
      expect(summary.find('[data-testid="checkout-terms"]').exists()).toBe(
        false,
      );
      expect(sendButton(wrapper).text()).toContain(
        'portal.quotations.request.send',
      );
      expect(
        wrapper.find('[data-testid="quote-request-hint"]').text(),
      ).toContain('portal.quotations.request.send_hint');
    });
  });

  it('counts the lines, not the pieces, in the subtotal', async () => {
    const line = makeQuote().lineItems[0]!;
    const wrapper = await mountWith(
      draft({
        lineItems: [line, { ...line, id: 'line-b', skuId: 12, quantity: 5 }],
      }),
    );

    expect(
      wrapper.find('[data-testid="checkout-order-summary"]').text(),
    ).toContain('(portal.quotations.request.lines_count 2)');
  });

  describe('an empty draft', () => {
    it('says the draft is empty and cannot be sent', async () => {
      const wrapper = await mountWith(draft({ lineItems: [] }));

      expect(wrapper.find('[data-testid="quote-request-empty"]').exists()).toBe(
        true,
      );
      expect(sendButton(wrapper).attributes('disabled')).toBeDefined();
    });

    it('shows no empty note when there are lines', async () => {
      const wrapper = await mountWith(draft());

      expect(wrapper.find('[data-testid="quote-request-empty"]').exists()).toBe(
        false,
      );
      expect(sendButton(wrapper).attributes('disabled')).toBeUndefined();
    });
  });

  describe('sending', () => {
    it('sends the trimmed details and lands on the sent page', async () => {
      mockSendQuoteRequest.mockResolvedValue(draft({ status: 'requested' }));
      const wrapper = await mountWith(draft());

      await wrapper
        .find('[data-testid="checkout-desired-delivery-date"]')
        .setValue('2099-12-01');
      await wrapper
        .find('[data-testid="checkout-customer-order-number"]')
        .setValue('  PO-77  ');
      await wrapper
        .find('[data-testid="checkout-goods-label"]')
        .setValue(' Lastbrygga B  ');
      await wrapper
        .find('[data-testid="quote-request-message"]')
        .setValue('  Leverans till lager 2 ');
      await send(wrapper);

      expect(mockSendQuoteRequest).toHaveBeenCalledWith('q-001', {
        desiredDeliveryDate: '2099-12-01',
        customerOrderNumber: 'PO-77',
        goodsLabel: 'Lastbrygga B',
        comment: 'Leverans till lager 2',
      });
      expect(mockNavigateTo).toHaveBeenCalledWith(`${VIEW_PATH}/sent`);
    });

    it('sends blank fields as left out', async () => {
      const wrapper = await mountWith(draft());

      await wrapper
        .find('[data-testid="checkout-customer-order-number"]')
        .setValue('   ');
      await wrapper.find('[data-testid="checkout-goods-label"]').setValue('  ');
      await send(wrapper);

      expect(mockSendQuoteRequest).toHaveBeenCalledWith('q-001', {
        desiredDeliveryDate: undefined,
        customerOrderNumber: undefined,
        goodsLabel: undefined,
        comment: undefined,
      });
    });

    it('stays on the page and shows the error when sending fails', async () => {
      const wrapper = await mountWith(draft());
      mockSendQuoteRequest.mockImplementation(() => {
        mockStoreError.value = 'portal.quotations.request.send_failed';
        return Promise.resolve(null);
      });

      await send(wrapper);

      expect(mockNavigateTo).not.toHaveBeenCalled();
      expect(
        wrapper.find('[data-testid="quote-request-error"]').text(),
      ).toContain('portal.quotations.request.send_failed');
    });

    it('does not send a date in the past, and says why', async () => {
      const wrapper = await mountWith(draft());

      await wrapper
        .find('[data-testid="checkout-desired-delivery-date"]')
        .setValue('2020-01-01');
      expect(
        wrapper.find('[data-testid="quote-request-date-error"]').exists(),
      ).toBe(false);
      await send(wrapper);

      expect(mockSendQuoteRequest).not.toHaveBeenCalled();
      expect(
        wrapper.find('[data-testid="quote-request-date-error"]').text(),
      ).toBe('portal.quotations.request.date_past');
    });

    it("sends today's date", async () => {
      const wrapper = await mountWith(draft());
      const today = new Date().toLocaleDateString('en-CA');

      await wrapper
        .find('[data-testid="checkout-desired-delivery-date"]')
        .setValue(today);
      await send(wrapper);

      expect(mockSendQuoteRequest).toHaveBeenCalledWith(
        'q-001',
        expect.objectContaining({ desiredDeliveryDate: today }),
      );
    });

    it('locks the form and the button while sending', async () => {
      const wrapper = await mountWith(draft());
      mockIsActionLoading.value = true;
      await flushPromises();

      expect(sendButton(wrapper).attributes('disabled')).toBeDefined();
      expect(
        wrapper
          .find('[data-testid="quote-request-message"]')
          .attributes('disabled'),
      ).toBeDefined();
      expect(
        wrapper
          .find('[data-testid="checkout-customer-order-number"]')
          .attributes('disabled'),
      ).toBeDefined();
      expect(
        wrapper
          .find('[data-testid="checkout-goods-label"]')
          .attributes('disabled'),
      ).toBeDefined();
    });

    it('clears a stale store error on arrival', async () => {
      mockStoreError.value = 'portal.quotations.request.send_failed';

      const wrapper = await mountWith(draft());

      expect(wrapper.find('[data-testid="quote-request-error"]').exists()).toBe(
        false,
      );
    });
  });
});
