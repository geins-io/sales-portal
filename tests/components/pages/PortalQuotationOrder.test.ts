import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h, ref, Suspense, onErrorCaptured } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { defaultMountOptions } from '../../utils/component';
import type { Quote, QuoteStatus } from '../../../shared/types/quote';
import { makeQuote } from '../../fixtures/quote';
import { mockShowIncVat } from '../../setup-components';

// The shared mock fills `{name}` placeholders, and keys carry none; this one
// appends the values so the banner and title can be checked.
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${Object.values(params).join(' ')}` : key,
    locale: ref('en'),
  }),
}));

const {
  mockData,
  mockError,
  mockUseFetch,
  mockNavigateTo,
  mockFinalizeQuote,
  mockIsActionLoading,
  mockStoreError,
  mockCanAccess,
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref } = require('vue') as typeof import('vue');
  return {
    mockData: ref<{ quote: Quote } | null>(null),
    mockError: ref<Error | null>(null),
    mockUseFetch: vi.fn(),
    mockNavigateTo: vi.fn((..._args: unknown[]) => Promise.resolve()),
    mockFinalizeQuote: vi.fn(
      (_id: string): Promise<Quote | null> => Promise.resolve(null),
    ),
    mockIsActionLoading: ref(false),
    mockStoreError: ref<string | null>(null),
    mockCanAccess: vi.fn((_name: string) => true),
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
  path: '/portal/quotations/q-001/order',
  query: {},
  hash: '',
  fullPath: '/portal/quotations/q-001/order',
  name: 'portal-quotations-id-order',
  matched: [],
  meta: {},
};
vi.stubGlobal('useRoute', () => route);
vi.mock('#app/composables/router', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useRoute: () => route,
  navigateTo: (...args: unknown[]) => mockNavigateTo(...args),
}));

vi.mock('../../../app/composables/useFeatureAccess', () => ({
  useFeatureAccess: () => ({ canAccess: mockCanAccess }),
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
    finalizeQuote: (id: string) => mockFinalizeQuote(id),
  }),
}));

const { default: PortalQuotationOrder } =
  await import('../../../app/pages/portal/quotations/[id]/order.vue');

const VIEW_PATH = '/se/en/portal/quotations/q-001';

const stubs = {
  // The terms component is covered in CheckoutTermsAgreement.test.ts; here it
  // only has to hand the box's value to the page.
  CheckoutTermsAgreement: {
    props: ['modelValue', 'disabled'],
    emits: ['update:modelValue'],
    template: `<input type="checkbox" data-testid="terms-box" :checked="modelValue" :disabled="disabled"
      @change="$emit('update:modelValue', $event.target.checked)" />`,
  },
  GeinsImage: { template: '<img />' },
};

async function mountPage() {
  const captured: Array<Error & { statusCode?: number }> = [];
  const Wrapper = defineComponent({
    setup() {
      onErrorCaptured((err) => {
        captured.push(err as Error & { statusCode?: number });
        return false;
      });
      return () =>
        h(Suspense, null, { default: () => h(PortalQuotationOrder) });
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
  mockData.value = { quote };
  return (await mountPage()).wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountWith>>;

const orderable = (overrides: Partial<Quote> = {}) =>
  makeQuote({
    status: 'pending',
    company: {
      name: 'Acme AB',
      companyId: 'internal-7',
      vatNumber: '556677-8899',
    },
    billingAddress: { company: 'Acme AB', addressLine1: 'Billing 1' },
    shippingAddress: { company: 'Acme AB', addressLine1: 'Dock 2' },
    ...overrides,
  });

async function tickTerms(wrapper: Wrapper) {
  await wrapper.find('[data-testid="terms-box"]').setValue(true);
}

async function place(wrapper: Wrapper) {
  await wrapper.find('[data-testid="quote-order-place"]').trigger('click');
  await flushPromises();
}

describe('PortalQuotationOrder', () => {
  beforeEach(() => {
    mockData.value = null;
    mockError.value = null;
    mockIsActionLoading.value = false;
    mockStoreError.value = null;
    mockUseFetch.mockClear();
    mockNavigateTo.mockClear();
    mockFinalizeQuote.mockReset();
    mockFinalizeQuote.mockResolvedValue(null);
    mockCanAccess.mockReset();
    mockCanAccess.mockReturnValue(true);
    mockShowIncVat.value = true;
  });

  it('reads the quotation by id with dedupe: defer', async () => {
    await mountWith(orderable());

    const [urlOrFn, options] = mockUseFetch.mock.calls[0]!;
    const url = typeof urlOrFn === 'function' ? urlOrFn() : urlOrFn;
    expect(url).toBe('/api/quotes/q-001');
    expect(options).toMatchObject({ dedupe: 'defer' });
  });

  it('throws a 404 when the quotation cannot be read', async () => {
    mockError.value = new Error('Network error');

    const { captured } = await mountPage();

    expect(captured[0]).toMatchObject({ statusCode: 404, fatal: true });
  });

  describe('who gets in', () => {
    it('stays on the page for an orderable quotation', async () => {
      const wrapper = await mountWith(orderable());

      expect(mockNavigateTo).not.toHaveBeenCalled();
      expect(wrapper.find('[data-testid="quote-order-page"]').exists()).toBe(
        true,
      );
    });

    it.each<QuoteStatus>([
      'request_draft',
      'requested',
      'confirmed',
      'finalized',
      'rejected',
      'canceled',
      'expired',
      'unknown',
    ])('sends a %s quotation back to the quotation view', async (status) => {
      const wrapper = await mountWith(orderable({ status }));

      expect(mockNavigateTo).toHaveBeenCalledWith(VIEW_PATH, { replace: true });
      expect(wrapper.find('[data-testid="quote-order-page"]').exists()).toBe(
        false,
      );
    });

    it('sends a Monitor-linked quotation back to the quotation view', async () => {
      await mountWith(orderable({ externalReference: { number: 'M-1' } }));

      expect(mockNavigateTo).toHaveBeenCalledWith(VIEW_PATH, { replace: true });
    });

    it('sends the buyer back when orderPlacement access is denied', async () => {
      mockCanAccess.mockImplementation((name) => name !== 'orderPlacement');

      const wrapper = await mountWith(orderable());

      expect(mockCanAccess).toHaveBeenCalledWith('orderPlacement');
      expect(mockNavigateTo).toHaveBeenCalledWith(VIEW_PATH, { replace: true });
      expect(wrapper.find('[data-testid="quote-order-place"]').exists()).toBe(
        false,
      );
    });
  });

  describe('what the order will be', () => {
    it('shows the quotation number in the banner and its name in the title', async () => {
      const wrapper = await mountWith(orderable({ name: 'Spring order' }));

      expect(
        wrapper.find('[data-testid="quote-order-banner"]').text(),
      ).toContain('QUO-2026-001');
      expect(
        wrapper.find('[data-testid="quote-order-title"]').text(),
      ).toContain('Spring order');
    });

    it('lists the lines read-only', async () => {
      const wrapper = await mountWith(orderable());

      const row = wrapper.find('[data-testid="line-item-row"]');
      expect(row.text()).toContain('Widget Pro');
      expect(row.find('[data-testid="line-item-quantity"]').text()).toBe('2');
      expect(row.find('[data-testid="line-item-total-price"]').text()).toBe(
        '200,00 kr',
      );
      expect(
        wrapper
          .find('[data-testid="quote-order-page"] input[type="number"]')
          .exists(),
      ).toBe(false);
    });

    it('shows the summary from the quotation', async () => {
      const wrapper = await mountWith(orderable());

      expect(
        wrapper.find('[data-testid="quote-summary-subtotal"]').text(),
      ).toBe('200,00 kr');
      expect(wrapper.find('[data-testid="quote-summary-total"]').text()).toBe(
        '250,00 kr',
      );
    });

    it('shows company, both addresses and the payment terms', async () => {
      const wrapper = await mountWith(orderable());

      expect(
        wrapper.find('[data-testid="quote-order-company"]').text(),
      ).toContain('Acme AB');
      expect(
        wrapper.find('[data-testid="order-delivery-address"]').text(),
      ).toContain('Dock 2');
      expect(
        wrapper.find('[data-testid="order-invoice-address"]').text(),
      ).toContain('Billing 1');
      expect(
        wrapper.find('[data-testid="quote-order-payment"]').text(),
      ).toContain('Net 30');
    });

    it("shows the company's org number, never its internal id", async () => {
      const wrapper = await mountWith(orderable());

      expect(
        wrapper.find('[data-testid="quote-order-org-number"]').text(),
      ).toBe('checkout.vat_number: 556677-8899');
      expect(
        wrapper.find('[data-testid="quote-order-company"]').text(),
      ).not.toContain('internal-7');
    });

    it('has no org number row when the company has no org number', async () => {
      const wrapper = await mountWith(
        orderable({ company: { name: 'Acme AB', companyId: 'internal-7' } }),
      );

      expect(
        wrapper.find('[data-testid="quote-order-org-number"]').exists(),
      ).toBe(false);
      expect(
        wrapper.find('[data-testid="quote-order-company"]').text(),
      ).not.toContain('internal-7');
    });

    it('leaves out a card or block the quotation has no data for', async () => {
      const wrapper = await mountWith(
        orderable({
          company: undefined,
          billingAddress: undefined,
          paymentTerms: undefined,
          expiresAt: undefined,
        }),
      );

      expect(wrapper.find('[data-testid="quote-order-company"]').exists()).toBe(
        false,
      );
      expect(
        wrapper.find('[data-testid="order-invoice-address"]').exists(),
      ).toBe(false);
      expect(
        wrapper.find('[data-testid="quote-order-payment"]').text(),
      ).not.toContain('portal.quotations.payment_terms');
      expect(
        wrapper.find('[data-testid="quote-order-valid-until"]').exists(),
      ).toBe(false);
    });
  });

  describe('placing the order', () => {
    it('asks for the terms and does not call finalize without the box', async () => {
      const wrapper = await mountWith(orderable());

      expect(
        wrapper.find('[data-testid="quote-order-terms-required"]').exists(),
      ).toBe(false);
      await place(wrapper);

      expect(mockFinalizeQuote).not.toHaveBeenCalled();
      expect(
        wrapper.find('[data-testid="quote-order-terms-required"]').exists(),
      ).toBe(true);
    });

    it('finalizes once with the box ticked, then opens the quotation view', async () => {
      mockFinalizeQuote.mockResolvedValue(orderable({ status: 'finalized' }));
      const wrapper = await mountWith(orderable());

      await tickTerms(wrapper);
      await place(wrapper);

      expect(mockFinalizeQuote).toHaveBeenCalledTimes(1);
      expect(mockFinalizeQuote).toHaveBeenCalledWith('q-001');
      expect(mockNavigateTo).toHaveBeenCalledWith(VIEW_PATH);
    });

    it('ignores a second click while the order is being placed', async () => {
      let answer!: (quote: Quote | null) => void;
      mockFinalizeQuote.mockReturnValue(
        new Promise((resolve) => {
          answer = resolve;
        }),
      );
      const wrapper = await mountWith(orderable());

      await tickTerms(wrapper);
      const button = wrapper.find('[data-testid="quote-order-place"]');
      await button.trigger('click');
      await button.trigger('click');
      expect(button.attributes('disabled')).toBeDefined();
      answer(null);
      await flushPromises();

      expect(mockFinalizeQuote).toHaveBeenCalledTimes(1);
    });

    it('stays with the error when the order fails', async () => {
      mockFinalizeQuote.mockImplementation(() => {
        mockStoreError.value = 'portal.quotations.order.failed';
        return Promise.resolve(null);
      });
      const wrapper = await mountWith(orderable());

      await tickTerms(wrapper);
      await place(wrapper);

      expect(mockNavigateTo).not.toHaveBeenCalled();
      expect(wrapper.find('[data-testid="quote-order-error"]').text()).toBe(
        'portal.quotations.order.failed',
      );
      expect(
        wrapper
          .find('[data-testid="quote-order-place"]')
          .attributes('disabled'),
      ).toBeUndefined();
    });

    it('clears an error left by another page', async () => {
      mockStoreError.value = 'portal.quotations.accept_failed';

      const wrapper = await mountWith(orderable());

      expect(wrapper.find('[data-testid="quote-order-error"]').exists()).toBe(
        false,
      );
    });
  });
});
