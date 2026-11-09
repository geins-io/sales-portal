import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h, ref, Suspense, onErrorCaptured } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { defaultMountOptions } from '../../utils/component';
import type { Quote, QuoteStatus } from '../../../shared/types/quote';
import { makeQuote } from '../../fixtures/quote';
import { mockShowIncVat } from '../../setup-components';
import type { AuthUser } from '@geins/types';
import { useAuthStore } from '../../../app/stores/auth';

const BUYER: AuthUser = { userId: '1', username: 'buyer@acme.test' };

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
      (_id: string, _message?: string): Promise<Quote | null> =>
        Promise.resolve(null),
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
    finalizeQuote: (id: string, message?: string) =>
      mockFinalizeQuote(id, message),
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
    customer: { id: 'buyer@acme.test', firstName: 'Anna', lastName: 'Berg' },
    paymentMethods: [{ id: '18', name: 'ManualInvoice', fee: 0 }],
    ...overrides,
  });

const DETAILS: NonNullable<Quote['orderDetails']> = {
  customerOrderNumber: 'PO-4411',
  desiredDeliveryDate: '2026-12-01',
  goodsLabel: 'Dock B',
};
const REFERENCE = '[data-testid="checkout-customer-order-number"]';
const DATE = '[data-testid="checkout-desired-delivery-date"]';
const GOODS_LABEL = '[data-testid="checkout-goods-label"]';
const PLACE = '[data-testid="place-order-button"]';
const MESSAGE = '[data-testid="quote-order-message"]';

async function tickTerms(wrapper: Wrapper) {
  await wrapper.find('[data-testid="terms-box"]').setValue(true);
}

async function place(wrapper: Wrapper) {
  await wrapper.find(PLACE).trigger('click');
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
    useAuthStore().user = BUYER;
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
      expect(wrapper.find(PLACE).exists()).toBe(false);
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

    it('lists the quotation\'s lines in the "Artiklar" card', async () => {
      const wrapper = await mountWith(orderable());

      const card = wrapper.find('[data-testid="quote-articles"]');
      expect(card.text()).toContain('portal.quotations.items_heading');
      const rows = card.findAll('[data-testid="line-item-row"]');
      expect(rows).toHaveLength(1);
      expect(rows[0]!.text()).toContain('Widget Pro');
      expect(rows[0]!.text()).toContain('ART-001');
      expect(rows[0]!.find('[data-testid="line-item-quantity"]').text()).toBe(
        '2',
      );
      expect(
        rows[0]!.find('[data-testid="line-item-total-price"]').text(),
      ).toBe('200,00 kr');
      expect(card.findAll('[data-testid="line-item-card"]')).toHaveLength(1);
      expect(wrapper.find('[data-testid="checkout-cart-items"]').exists()).toBe(
        false,
      );
    });

    it('shows the lines ex VAT when the buyer reads ex VAT', async () => {
      mockShowIncVat.value = false;
      const wrapper = await mountWith(orderable());

      expect(
        wrapper
          .find(
            '[data-testid="line-item-row"] [data-testid="line-item-total-price"]',
          )
          .text(),
      ).toBe('160,00 kr');
    });

    it("shows the company, org number, billing address and buyer in the checkout's card", async () => {
      const wrapper = await mountWith(orderable());

      const card = wrapper.find('[data-testid="checkout-company-info"]');
      expect(card.find('[data-testid="company-name"]').text()).toContain(
        'Acme AB',
      );
      expect(card.find('[data-testid="company-vat"]').text()).toContain(
        '556677-8899',
      );
      expect(
        card.find('[data-testid="company-billing-address"]').text(),
      ).toContain('Billing 1');
      const buyer = card.find('[data-testid="company-buyer"]').text();
      expect(buyer).toContain('Anna Berg');
      expect(buyer).toContain('buyer@acme.test');
      expect(card.text()).not.toContain('internal-7');
    });

    it('shows the email alone when the quotation names no buyer', async () => {
      const wrapper = await mountWith(orderable({ customer: undefined }));

      const buyer = wrapper.find('[data-testid="company-buyer"]').text();
      expect(buyer).toContain('buyer@acme.test');
      expect(buyer).not.toContain('Anna');
    });

    it("shows the quotation's shipping address as the delivery address", async () => {
      const wrapper = await mountWith(orderable());

      expect(wrapper.find('[data-testid="delivery-address"]').text()).toContain(
        'Dock 2',
      );
    });

    it('says under the delivery address that the addresses come from the quotation', async () => {
      const wrapper = await mountWith(orderable());

      expect(
        wrapper
          .find(
            '[data-testid="checkout-delivery-info"] [data-testid="quote-order-addresses-locked"]',
          )
          .text(),
      ).toBe('portal.quotations.order.addresses_locked');
    });

    it('leaves out the company and delivery cards without a company', async () => {
      const wrapper = await mountWith(orderable({ company: undefined }));

      expect(
        wrapper.find('[data-testid="checkout-company-info"]').exists(),
      ).toBe(false);
      expect(
        wrapper.find('[data-testid="checkout-delivery-info"]').exists(),
      ).toBe(false);
    });

    it('shows the PO number, date and goods label the order gets', async () => {
      const wrapper = await mountWith(orderable({ orderDetails: DETAILS }));

      expect(wrapper.find<HTMLInputElement>(REFERENCE).element.value).toBe(
        'PO-4411',
      );
      expect(wrapper.find<HTMLInputElement>(DATE).element.value).toBe(
        '2026-12-01',
      );
      expect(wrapper.find<HTMLInputElement>(GOODS_LABEL).element.value).toBe(
        'Dock B',
      );
    });

    it('hides the PO number, date and goods label when the quotation carries none', async () => {
      const wrapper = await mountWith(orderable());

      expect(wrapper.find(REFERENCE).exists()).toBe(false);
      expect(wrapper.find(DATE).exists()).toBe(false);
      expect(wrapper.find(GOODS_LABEL).exists()).toBe(false);
    });

    it("preselects the only payment method under the checkout's invoice label, and shows the terms", async () => {
      const wrapper = await mountWith(orderable());

      const radios = wrapper.findAll<HTMLInputElement>(
        '[data-testid="checkout-payment-options"] input[type="radio"]',
      );
      expect(radios).toHaveLength(1);
      expect(radios[0]!.element.checked).toBe(true);
      expect(
        wrapper.find('[data-testid="checkout-payment-options"]').text(),
      ).toContain('checkout.payment_types.invoice');
      expect(
        wrapper.find('[data-testid="checkout-payment-options"]').text(),
      ).not.toContain('ManualInvoice');
      expect(
        wrapper.find('[data-testid="quote-order-payment-terms"]').text(),
      ).toContain('Net 30');
    });

    it("shows the method's display name when Geins gives one", async () => {
      const wrapper = await mountWith(
        orderable({
          paymentMethods: [
            {
              id: '18',
              name: 'ManualInvoice',
              displayName: 'Faktura 30 dagar',
              fee: 0,
            },
          ],
        }),
      );

      const options = wrapper.find('[data-testid="checkout-payment-options"]');
      expect(options.text()).toContain('Faktura 30 dagar');
      expect(options.text()).not.toContain('checkout.payment_types.invoice');
    });

    it('selects nothing when the quotation allows more than one method', async () => {
      const wrapper = await mountWith(
        orderable({
          paymentMethods: [
            { id: '18', name: 'ManualInvoice', fee: 0 },
            { id: '23', name: 'Card', fee: 0 },
          ],
        }),
      );

      const radios = wrapper.findAll<HTMLInputElement>(
        '[data-testid="checkout-payment-options"] input[type="radio"]',
      );
      expect(radios).toHaveLength(2);
      expect(radios.some((radio) => radio.element.checked)).toBe(false);
    });

    it('has no terms line without terms', async () => {
      const wrapper = await mountWith(orderable({ paymentTerms: undefined }));

      expect(
        wrapper.find('[data-testid="quote-order-payment-terms"]').exists(),
      ).toBe(false);
    });

    it("shows the quotation's summary in the checkout's summary", async () => {
      const wrapper = await mountWith(orderable({ discount: 20 }));

      const summary = wrapper.find('[data-testid="checkout-order-summary"]');
      expect(
        summary.find('[data-testid="checkout-summary-subtotal"]').text(),
      ).toBe('200,00 kr');
      expect(
        summary.find('[data-testid="checkout-summary-total"]').text(),
      ).toBe('250,00 kr');
      expect(summary.find('[data-testid="checkout-summary-tax"]').text()).toBe(
        '50,00 kr',
      );
      expect(
        summary.find('[data-testid="checkout-summary-discount"]').exists(),
      ).toBe(true);
      // The count is of items, as on the checkout: 2 of one line.
      expect(summary.text()).toContain('checkout.items_count 2');
    });

    it('shows the ex-VAT amounts when the buyer reads ex VAT', async () => {
      mockShowIncVat.value = false;
      const wrapper = await mountWith(orderable());

      expect(
        wrapper.find('[data-testid="checkout-summary-subtotal"]').text(),
      ).toBe('160,00 kr');
      expect(
        wrapper.find('[data-testid="checkout-summary-to-pay"]').text(),
      ).toContain('250,00 kr');
    });

    it('shows the validity in the summary', async () => {
      const wrapper = await mountWith(orderable());

      expect(
        wrapper
          .find(
            '[data-testid="checkout-order-summary"] [data-testid="quote-order-valid-until"]',
          )
          .exists(),
      ).toBe(true);
    });

    it('has no validity line without an end date', async () => {
      const wrapper = await mountWith(orderable({ expiresAt: undefined }));

      expect(
        wrapper.find('[data-testid="quote-order-valid-until"]').exists(),
      ).toBe(false);
    });
  });

  describe("only the message and the terms are the buyer's to give", () => {
    it('disables every control except the message and the terms box, with every value shown', async () => {
      const wrapper = await mountWith(orderable({ orderDetails: DETAILS }));

      const controls = wrapper
        .find('[data-testid="quote-order-page"]')
        .findAll('input, textarea, select, button');
      const enabled = controls.filter(
        (control) =>
          !(control.element as HTMLInputElement).disabled &&
          !['terms-box', 'quote-order-message'].includes(
            control.attributes('data-testid') ?? '',
          ),
      );
      expect(controls.length).toBeGreaterThan(5);
      expect(enabled.map((control) => control.html())).toEqual([]);
    });

    it('has no remove button', async () => {
      const wrapper = await mountWith(orderable({ orderDetails: DETAILS }));

      expect(
        wrapper.find('[data-testid="checkout-remove-item"]').exists(),
      ).toBe(false);
    });

    it("has the checkout's message field, empty, up to 2000 characters", async () => {
      const wrapper = await mountWith(orderable());

      const card = wrapper.find('[data-testid="quote-order-message-card"]');
      expect(card.text()).toContain('checkout.order_message');
      const field = card.find<HTMLTextAreaElement>(MESSAGE);
      expect(field.element.value).toBe('');
      expect(field.attributes('maxlength')).toBe('2000');
      expect(field.attributes('placeholder')).toBe(
        'checkout.order_message_placeholder',
      );
    });
  });

  describe('placing the order', () => {
    it('keeps the button disabled until the terms are accepted', async () => {
      const wrapper = await mountWith(orderable());

      expect(wrapper.find(PLACE).attributes('disabled')).toBeDefined();
      await tickTerms(wrapper);
      expect(wrapper.find(PLACE).attributes('disabled')).toBeUndefined();
    });

    it('finalizes once with the box ticked, then opens the thank-you page', async () => {
      mockFinalizeQuote.mockResolvedValue(orderable({ status: 'finalized' }));
      const wrapper = await mountWith(orderable());

      await tickTerms(wrapper);
      await place(wrapper);

      expect(mockFinalizeQuote).toHaveBeenCalledTimes(1);
      expect(mockFinalizeQuote).toHaveBeenCalledWith('q-001', undefined);
      expect(mockNavigateTo).toHaveBeenCalledWith(`${VIEW_PATH}/ordered`);
    });

    it('clears a message written on an earlier try, so it never reaches the order', async () => {
      mockFinalizeQuote.mockResolvedValueOnce(null);
      mockFinalizeQuote.mockResolvedValueOnce(
        orderable({ status: 'finalized' }),
      );
      const wrapper = await mountWith(orderable());

      await wrapper.find(MESSAGE).setValue('A');
      await tickTerms(wrapper);
      await place(wrapper);
      await wrapper.find(MESSAGE).setValue('   ');
      await place(wrapper);

      expect(mockFinalizeQuote.mock.calls).toEqual([
        ['q-001', 'A'],
        ['q-001', ''],
      ]);
    });

    it('places the order with the message the buyer wrote', async () => {
      mockFinalizeQuote.mockResolvedValue(orderable({ status: 'finalized' }));
      const wrapper = await mountWith(orderable());

      await wrapper.find(MESSAGE).setValue('Ring innan leverans');
      await tickTerms(wrapper);
      await place(wrapper);

      expect(mockFinalizeQuote).toHaveBeenCalledWith(
        'q-001',
        'Ring innan leverans',
      );
    });

    it('locks the message while the order is being placed, and keeps it on failure', async () => {
      let answer!: (quote: Quote | null) => void;
      mockFinalizeQuote.mockReturnValue(
        new Promise((resolve) => {
          answer = resolve;
        }),
      );
      const wrapper = await mountWith(orderable());

      await wrapper.find(MESSAGE).setValue('Hej');
      await tickTerms(wrapper);
      await wrapper.find(PLACE).trigger('click');
      expect(wrapper.find(MESSAGE).attributes('disabled')).toBeDefined();
      answer(null);
      await flushPromises();

      const field = wrapper.find<HTMLTextAreaElement>(MESSAGE);
      expect(field.attributes('disabled')).toBeUndefined();
      expect(field.element.value).toBe('Hej');
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
      const button = wrapper.find(PLACE);
      await button.trigger('click');
      await button.trigger('click');
      expect(button.attributes('disabled')).toBeDefined();
      answer(null);
      await flushPromises();

      expect(mockFinalizeQuote).toHaveBeenCalledTimes(1);
    });

    it('stays with the error in the summary when the order fails', async () => {
      mockFinalizeQuote.mockImplementation(() => {
        mockStoreError.value = 'portal.quotations.order.failed';
        return Promise.resolve(null);
      });
      const wrapper = await mountWith(orderable());

      await tickTerms(wrapper);
      await place(wrapper);

      expect(mockNavigateTo).not.toHaveBeenCalled();
      expect(
        wrapper
          .find(
            '[data-testid="checkout-order-summary"] [data-testid="quote-order-error"]',
          )
          .text(),
      ).toBe('portal.quotations.order.failed');
      expect(wrapper.find(PLACE).attributes('disabled')).toBeUndefined();
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
