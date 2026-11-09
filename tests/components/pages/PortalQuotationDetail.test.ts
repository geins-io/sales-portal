import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  defineComponent,
  h,
  ref,
  Suspense,
  onErrorCaptured,
  type VNode,
} from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { Hash, MessageSquare, Tag, Truck } from 'lucide-vue-next';
import { defaultMountOptions } from '../../utils/component';
import type { Quote, QuoteStatus } from '../../../shared/types/quote';
import { makeQuote } from '../../fixtures/quote';
import { mockShowIncVat } from '../../setup-components';

// Per-file override of the shared `vue-i18n` mock from `tests/setup-components.ts`.
// Wraps `t` in a `vi.fn` so individual cases (e.g. D8 subtotal-with-count) can
// assert the interpolation args were actually passed. Shape must match the shared
// mock — `useI18n` returning `{ t, locale }` — or components that read
// `locale.value` (e.g. via `formatDate`) will break. The spy must be hoisted
// so it's available inside the `vi.mock` factory (which is hoisted above
// imports).
const { tSpy } = vi.hoisted(() => ({
  tSpy: vi.fn((key: string, params?: Record<string, unknown>): string => {
    if (!params) return key;
    let result = key;
    for (const [k, v] of Object.entries(params)) {
      result = result.replace(`{${k}}`, String(v));
    }
    return result;
  }),
}));
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: tSpy, locale: ref('en') }),
}));

// The tenant hides prices for the whole file: a quotation shows its prices
// whatever the tenant's price visibility, so every amount below must still show.
vi.mock('../../../app/composables/usePriceVisibility', async () => {
  const { ref } = await import('vue');
  return { usePriceVisibility: () => ({ showPrice: ref(false) }) };
});

const { mockCanAccess } = vi.hoisted(() => ({
  mockCanAccess: vi.fn((_name: string) => true),
}));
vi.mock('../../../app/composables/useFeatureAccess', () => ({
  useFeatureAccess: () => ({ canAccess: mockCanAccess }),
}));

// Hoist reactive mock state so it's available inside vi.mock factories
const {
  mockData,
  mockError,
  mockPending,
  mockUseFetch,
  mockAcceptQuote,
  mockRejectQuote,
  mockIsActionLoading,
  mockIsLoading,
  mockStoreCurrentQuote,
  mockStoreError,
  mockCreateError,
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref } = require('vue') as typeof import('vue');

  const createErrorFn = (opts: {
    statusCode: number;
    statusMessage?: string;
    fatal?: boolean;
  }) => {
    const err = new Error(opts.statusMessage ?? '') as Error & {
      statusCode: number;
      statusMessage: string;
      fatal: boolean;
    };
    err.statusCode = opts.statusCode;
    err.statusMessage = opts.statusMessage ?? '';
    err.fatal = opts.fatal ?? false;
    return err;
  };

  const storeErrorRef = ref<string | null>(null);

  return {
    mockData: ref<{ quote: Quote } | null>(null),
    mockError: ref<Error | null>(null),
    mockPending: ref(false),
    mockUseFetch: vi.fn(),
    // Default implementations simulate the real store by clearing/setting
    // the shared error ref. Individual tests can override with mockImplementationOnce.
    mockAcceptQuote: vi.fn((_id: string): Promise<Quote | null> => {
      storeErrorRef.value = null;
      return Promise.resolve(null);
    }),
    mockRejectQuote: vi.fn((_id: string): Promise<Quote | null> => {
      storeErrorRef.value = null;
      return Promise.resolve(null);
    }),
    mockIsActionLoading: ref(false),
    mockIsLoading: ref(false),
    mockStoreCurrentQuote: ref<Quote | null>(null),
    mockStoreError: storeErrorRef,
    mockCreateError: createErrorFn,
  };
});

// Mock definePageMeta (Nuxt macro)
vi.stubGlobal('definePageMeta', vi.fn());

// Mock navigateTo
vi.stubGlobal('navigateTo', vi.fn());

// Mock createError — throw path uses this
vi.stubGlobal('createError', mockCreateError);

vi.mock('#app/composables/error', () => ({
  createError: (...args: Parameters<typeof mockCreateError>) =>
    mockCreateError(...args),
  showError: vi.fn(),
}));

// Mock useFetch — the detail page awaits it at the top of setup
mockUseFetch.mockImplementation(() => ({
  data: mockData,
  error: mockError,
  pending: mockPending,
  refresh: vi.fn(),
  execute: vi.fn(),
  status: { value: 'success' },
}));

vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: Parameters<typeof mockUseFetch>) => mockUseFetch(...args),
}));

vi.stubGlobal('useFetch', mockUseFetch);

// Mock route with an id param
vi.stubGlobal('useRoute', () => ({
  params: { id: 'q-001' },
  path: '/portal/quotations/q-001',
  query: {},
  hash: '',
  fullPath: '/portal/quotations/q-001',
  name: 'portal-quotations-id',
  matched: [],
  meta: {},
}));

vi.mock('#app/composables/router', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useRoute: () => ({
      params: { id: 'q-001' },
      path: '/portal/quotations/q-001',
      query: {},
      hash: '',
      fullPath: '/portal/quotations/q-001',
      name: 'portal-quotations-id',
      matched: [],
      meta: {},
    }),
  };
});

vi.mock('../../../app/stores/quotes', () => ({
  useQuotesStore: () => ({
    // currentQuote is read/written by the detail page — back with a hoisted ref
    get currentQuote() {
      return mockStoreCurrentQuote.value;
    },
    set currentQuote(value: Quote | null) {
      mockStoreCurrentQuote.value = value;
    },
    get isLoading() {
      return mockIsLoading.value;
    },
    get isActionLoading() {
      return mockIsActionLoading.value;
    },
    // error is reactive so the banner v-if updates when actions mutate it
    get error() {
      return mockStoreError.value;
    },
    set error(value: string | null) {
      mockStoreError.value = value;
    },
    acceptQuote: (...args: Parameters<typeof mockAcceptQuote>) =>
      mockAcceptQuote(...args),
    rejectQuote: (...args: Parameters<typeof mockRejectQuote>) =>
      mockRejectQuote(...args),
  }),
}));

// Import the component AFTER mocks are set up. Top-level-await in the
// component's <script setup> makes it an async component, so it must be
// rendered inside a <Suspense> boundary.
const { default: PortalQuotationDetail } =
  await import('../../../app/pages/portal/quotations/[id]/index.vue');

const defaultStubs = {
  PortalShell: {
    template: '<div data-testid="portal-shell"><slot /></div>',
  },
  Button: {
    template:
      '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>',
    emits: ['click'],
  },
  Icon: defineComponent({
    name: 'Icon',
    props: { name: { type: String, default: '' } },
    setup(props): () => VNode {
      return () => h('span', { class: 'icon', 'data-name': props.name });
    },
  }),
  // NuxtIcon is stubbed globally in tests/utils/component.ts — no per-file
  // entry needed. @nuxt/icon actually registers as <NuxtIcon>, not <Icon>.
  // The dialog itself is covered in PortalDialogConfirmQuoteAction.test.ts;
  // here it only has to show what the page passes and hand back the answer.
  PortalDialogConfirmQuoteAction: {
    props: [
      'open',
      'title',
      'description',
      'confirmLabel',
      'destructive',
      'pending',
    ],
    emits: ['update:open', 'confirm'],
    template: `<div v-if="open" data-testid="quote-action-dialog" :data-destructive="String(!!destructive)" :data-pending="String(!!pending)">
      <h2 data-testid="dialog-title">{{ title }}</h2>
      <p data-testid="dialog-description">{{ description }}</p>
      <button data-testid="quote-action-cancel" @click="$emit('update:open', false)">cancel</button>
      <button data-testid="quote-action-confirm" @click="$emit('confirm')">{{ confirmLabel }}</button>
    </div>`,
  },
  GeinsImage: {
    template:
      '<img data-testid="geins-image" :data-file-name="fileName" :data-type="type" :alt="alt" />',
    props: ['fileName', 'type', 'alt', 'aspectRatio', 'sizes', 'loading'],
  },
};

// Mount the detail page wrapped in <Suspense>. Captures any error thrown
// during async setup via onErrorCaptured so callers can assert the 404 throw.
async function mountDetailPage() {
  const captured: Array<Error & { statusCode?: number; fatal?: boolean }> = [];
  const Wrapper = defineComponent({
    components: { PortalQuotationDetail },
    setup() {
      onErrorCaptured((err) => {
        captured.push(err as Error & { statusCode?: number; fatal?: boolean });
        // Swallow so the test doesn't log an unhandled error
        return false;
      });
      return () =>
        h(Suspense, null, {
          default: () => h(PortalQuotationDetail),
          fallback: () => h('div', { 'data-testid': 'suspense-fallback' }),
        });
    },
  });

  const wrapper = mount(Wrapper, {
    ...defaultMountOptions,
    global: {
      ...defaultMountOptions.global,
      stubs: {
        ...(defaultMountOptions.global?.stubs ?? {}),
        ...defaultStubs,
      },
    },
  });
  await flushPromises();
  return { wrapper, captured };
}

const pending = (overrides: Partial<Quote> = {}) =>
  makeQuote({ status: 'pending', ...overrides });

async function mountWith(quote: Quote) {
  mockData.value = { quote };
  return (await mountDetailPage()).wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountWith>>;

/** Opens the dialog from a button and confirms it. */
async function answer(wrapper: Wrapper, button: string) {
  await wrapper.find(`[data-testid="${button}"]`).trigger('click');
  await wrapper.find('[data-testid="quote-action-confirm"]').trigger('click');
  await flushPromises();
}

async function openCustomerCard(wrapper: Wrapper) {
  await wrapper.find('[data-testid="customer-card-trigger"]').trigger('click');
  await flushPromises();
}

function metaKeys(wrapper: Wrapper): string[] {
  return wrapper
    .findAll('[data-testid="quote-meta"] [data-meta-row]')
    .map((row) => row.attributes('data-meta-row')!);
}

describe('PortalQuotationDetail', () => {
  beforeEach(() => {
    mockData.value = null;
    mockError.value = null;
    mockPending.value = false;
    mockIsActionLoading.value = false;
    mockIsLoading.value = false;
    mockStoreCurrentQuote.value = null;
    mockStoreError.value = null;
    mockUseFetch.mockClear();
    mockAcceptQuote.mockClear();
    mockAcceptQuote.mockImplementation(() => {
      mockStoreError.value = null;
      return Promise.resolve(null);
    });
    mockRejectQuote.mockClear();
    mockRejectQuote.mockImplementation(() => {
      mockStoreError.value = null;
      return Promise.resolve(null);
    });
    mockShowIncVat.value = true;
    mockCanAccess.mockReset();
    mockCanAccess.mockReturnValue(true);
  });

  describe('SSR 404 handling', () => {
    it('throws createError with statusCode 404 when useFetch errors', async () => {
      mockData.value = null;
      mockError.value = new Error('Network error');

      const { captured } = await mountDetailPage();

      // Vue may capture the same error at multiple boundaries (Suspense +
      // wrapper) — assert at least one matches our 404 throw.
      expect(captured.length).toBeGreaterThanOrEqual(1);
      expect(captured[0]).toMatchObject({ statusCode: 404, fatal: true });
    });

    it('throws createError with statusCode 404 when data has no quote', async () => {
      const { captured } = await mountDetailPage();

      expect(captured.length).toBeGreaterThanOrEqual(1);
      expect(captured[0]).toMatchObject({ statusCode: 404, fatal: true });
    });
  });

  describe('useFetch call', () => {
    it('calls useFetch with the quote id URL and dedupe: defer', async () => {
      await mountWith(makeQuote());

      const [urlOrFn, options] = mockUseFetch.mock.calls[0]!;
      const url = typeof urlOrFn === 'function' ? urlOrFn() : urlOrFn;
      expect(url).toBe('/api/quotes/q-001');
      expect(options).toMatchObject({ dedupe: 'defer' });
    });
  });

  describe('lines', () => {
    const twoLines = () =>
      makeQuote({
        lineItems: [
          makeQuote().lineItems[0]!,
          {
            productId: 2,
            sku: 'SKU-B',
            name: 'Gadget Plus',
            articleNumber: 'ART-002',
            quantity: 1,
            unitPrice: 50,
            unitPriceFormatted: '50,00 kr',
            totalPrice: 50,
            totalPriceFormatted: '50,00 kr',
            unitPriceExVat: 40,
            unitPriceExVatFormatted: '40,00 kr',
            totalPriceExVat: 40,
            totalPriceExVatFormatted: '40,00 kr',
            alias: 'gadget-plus',
          },
        ],
      });

    const sheetOf = (wrapper: Wrapper) =>
      wrapper.findComponent({ name: 'PortalItemRowsSheet' });

    it('renders every line in the desktop table', async () => {
      const wrapper = await mountWith(twoLines());

      const table = wrapper.find('[data-testid="order-items-table"]');
      const rows = table.findAll('[data-testid="order-item-row"]');
      expect(rows.map((row) => row.text())).toEqual([
        expect.stringContaining('Widget Pro'),
        expect.stringContaining('Gadget Plus'),
      ]);
      expect(rows[0]!.text()).toContain('ART-001');
      expect(rows[0]!.find('[data-testid="order-item-quantity"]').text()).toBe(
        '2',
      );
    });

    it('heads the table "items", as the quotation names its lines', async () => {
      const wrapper = await mountWith(makeQuote());

      const table = wrapper.find('[data-testid="order-items-table"]').element;
      expect(
        table.closest('div.hidden')?.querySelector('h3')?.textContent,
      ).toBe('portal.quotations.items_heading');
    });

    it('hands the same lines to the sheet for small screens, with the same numbers', async () => {
      const wrapper = await mountWith(twoLines());

      const sheet = sheetOf(wrapper);
      expect(
        (
          sheet.props('items') as {
            quantity: number;
            unitPriceFormatted: string;
            totalPriceFormatted: string;
          }[]
        ).map((row) => [
          row.quantity,
          row.unitPriceFormatted,
          row.totalPriceFormatted,
        ]),
      ).toEqual([
        [2, '100,00 kr', '200,00 kr'],
        [1, '50,00 kr', '50,00 kr'],
      ]);
      expect(sheet.props('triggerLabel')).toBe('portal.quotations.view_items');
      expect(sheet.props('title')).toBe('portal.quotations.items_heading');
      expect(sheet.props('showPrices')).toBe(true);
    });

    it('splits the table and the sheet at lg, as the order page does', async () => {
      const wrapper = await mountWith(makeQuote());

      const table = wrapper.find('[data-testid="order-items-table"]').element;
      expect([...(table.closest('div.hidden')?.classList ?? [])]).toEqual(
        expect.arrayContaining(['hidden', 'lg:block']),
      );
      expect(sheetOf(wrapper).classes()).toContain('lg:hidden');
    });

    it('opens the sheet from right under the summary card', async () => {
      const wrapper = await mountWith(makeQuote());

      expect(
        wrapper.find('[data-testid="order-summary"]').element
          .nextElementSibling,
      ).toBe(sheetOf(wrapper).element);
    });

    it('links a line with an alias to its product and leaves the others plain', async () => {
      const wrapper = await mountWith(twoLines());

      const links = wrapper.findAll('[data-testid="order-item-name-link"]');
      expect(links.map((link) => link.text())).toEqual(['Gadget Plus']);
      expect(
        wrapper.findAll('[data-testid="order-item-name"]')[0]!.text(),
      ).toBe('Widget Pro');
    });

    it('shows the thumbnail through GeinsImage, never a raw img', async () => {
      const wrapper = await mountWith(makeQuote());

      const imgs = wrapper.findAll('img');
      expect(imgs.length).toBeGreaterThan(0);
      for (const img of imgs) {
        expect(img.attributes('data-testid')).toBe('geins-image');
        expect(img.attributes('data-file-name')).toBe('/img/widget.jpg');
      }
    });

    it.each([
      [true, ['100,00 kr', '200,00 kr']],
      [false, ['80,00 kr', '160,00 kr']],
    ])(
      'prices the lines on the chosen VAT side (incl. VAT: %s)',
      async (incVat, [unit, line]) => {
        mockShowIncVat.value = incVat;
        const wrapper = await mountWith(makeQuote());
        const [row] = sheetOf(wrapper).props('items') as {
          unitPriceFormatted: string;
          totalPriceFormatted: string;
        }[];

        expect([
          wrapper.find('[data-testid="order-item-unit-price"]').text(),
          wrapper.find('[data-testid="order-item-total-price"]').text(),
          row!.unitPriceFormatted,
          row!.totalPriceFormatted,
        ]).toEqual([unit, line, unit, line]);
      },
    );
  });

  describe('header', () => {
    it('shows the name, or "detail_title #number" without one', async () => {
      expect(
        (await mountWith(makeQuote({ name: 'Dec order' })))
          .find('[data-testid="quote-title"]')
          .text(),
      ).toBe('Dec order');
      expect(
        (await mountWith(makeQuote({ name: undefined })))
          .find('[data-testid="quote-title"]')
          .text(),
      ).toBe('portal.quotations.detail_title #QUO-2026-001');
    });

    it.each<[QuoteStatus, string]>([
      ['requested', 'portal.quotations.kind_request · QUO-2026-001'],
      ['pending', 'portal.quotations.kind_quotation · QUO-2026-001'],
    ])('says what a %s one is, with its number', async (status, text) => {
      const wrapper = await mountWith(makeQuote({ status }));

      expect(wrapper.find('[data-testid="quote-kind"]').text()).toBe(text);
    });

    it('leaves the number off the kind line when there is none', async () => {
      const wrapper = await mountWith(makeQuote({ quoteNumber: '' }));

      expect(wrapper.find('[data-testid="quote-kind"]').text()).toBe(
        'portal.quotations.kind_quotation',
      );
    });

    it.each<[QuoteStatus, string]>([
      ['requested', 'portal.quotations.status_requested'],
      ['pending', 'portal.quotations.status_pending'],
      ['confirmed', 'portal.quotations.status_confirmed'],
      ['canceled', 'portal.quotations.status_canceled'],
    ])('shows the %s badge', async (status, label) => {
      const wrapper = await mountWith(makeQuote({ status }));

      expect(wrapper.find('[data-testid="status-badge"]').text()).toBe(label);
    });

    it('sits above the summary card, outside it', async () => {
      const wrapper = await mountWith(makeQuote());

      const header = wrapper.find('[data-testid="quote-header"]').element;
      const card = wrapper.find('[data-testid="order-summary"]').element;
      expect(card.contains(header)).toBe(false);
      expect(
        header.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('links back to the quotations list', async () => {
      const wrapper = await mountWith(makeQuote());

      const back = wrapper.find('[data-testid="back-link"]');
      expect(back.attributes('href')).toContain('/portal/quotations');
      expect(back.text()).toContain('portal.quotations.back_to_quotations');
    });

    it('has no communication button (it comes with the message thread)', async () => {
      const wrapper = await mountWith(makeQuote());

      expect(
        wrapper.find('[data-testid="quote-communication-open"]').exists(),
      ).toBe(false);
    });
  });

  describe('summary', () => {
    const shipped = (overrides: Partial<Quote> = {}) =>
      makeQuote({
        shipping: 100,
        shippingFormatted: '100,00 kr',
        shippingExVat: 80,
        shippingExVatFormatted: '80,00 kr',
        ...overrides,
      });

    /** The card's rows as [label, value], top to bottom. */
    function read(wrapper: Wrapper) {
      const card = wrapper.find('[data-testid="order-summary"]');
      const list = card.find('div.space-y-3\\.5').element;
      return {
        title: card.find('h3').text(),
        rows: [...list.children].map((row) =>
          [...row.children].map((cell) => cell.textContent?.trim()),
        ),
      };
    }

    it('lists the rows like the order summary, total in bold at the bottom, when inc is chosen', async () => {
      mockShowIncVat.value = true;
      tSpy.mockClear();
      const wrapper = await mountWith(shipped());

      expect(read(wrapper)).toEqual({
        title: 'portal.quotations.request.summary_title',
        rows: [
          ['portal.orders.detail.summary.subtotal_with_count', '200,00 kr'],
          ['portal.orders.detail.summary.shipping', '100,00 kr'],
          ['common.vat_included', '50,00 kr'],
          ['portal.orders.detail.summary.total', '250,00 kr'],
        ],
      });
      expect(tSpy).toHaveBeenCalledWith(
        'portal.orders.detail.summary.subtotal_with_count',
        { count: 1 },
      );
      expect(
        wrapper
          .find('[data-testid="order-summary-total"]')
          .element.parentElement?.classList.contains('font-semibold'),
      ).toBe(true);
    });

    it('ends on the inc total under the ex total, when ex is chosen', async () => {
      mockShowIncVat.value = false;
      expect(read(await mountWith(shipped())).rows).toEqual([
        ['portal.orders.detail.summary.subtotal_with_count', '160,00 kr'],
        ['portal.orders.detail.summary.shipping', '80,00 kr'],
        ['common.vat', '50,00 kr'],
        ['portal.orders.detail.summary.total', '200,00 kr'],
        ['common.total_inc_vat', '250,00 kr'],
      ]);
    });

    it('has no large lead sum above the rows', async () => {
      const wrapper = await mountWith(shipped());

      expect(wrapper.find('.text-3xl').exists()).toBe(false);
      expect(wrapper.find('[data-testid="quote-summary"]').exists()).toBe(
        false,
      );
    });

    it.each([
      [true, 'SEK\u00a062.50'],
      [false, 'SEK\u00a050.00'],
    ])(
      "shows the seller's percent discount with its rate (incl. VAT: %s)",
      async (incVat, amount) => {
        mockShowIncVat.value = incVat;
        tSpy.mockClear();
        const wrapper = await mountWith(
          makeQuote({ discount: 62.5, discountExVat: 50, discountPercent: 5 }),
        );

        expect(read(wrapper).rows[1]).toEqual([
          'portal.quotations.discount_percent',
          `-${amount}`,
        ]);
        expect(tSpy).toHaveBeenCalledWith(
          'portal.quotations.discount_percent',
          {
            percent: '5%',
          },
        );
      },
    );

    it('repeats the same rows under the table, discount included', async () => {
      mockShowIncVat.value = false;
      const wrapper = await mountWith(
        shipped({ discount: 62.5, discountExVat: 50, discountPercent: 5 }),
      );

      expect(
        wrapper
          .find('[data-testid="order-items-footer-discount"]')
          .element.previousElementSibling?.textContent?.trim(),
      ).toBe('portal.quotations.discount_percent');
      expect(
        [
          'order-items-footer-discount',
          'order-items-footer-shipping',
          'order-items-footer-total',
          'order-items-footer-total-inc-vat',
        ].map((id) => wrapper.find(`[data-testid="${id}"]`).text()),
      ).toEqual(['-SEK\u00a050.00', '80,00 kr', '200,00 kr', '250,00 kr']);
    });

    it('gives the sheet the same rows', async () => {
      mockShowIncVat.value = true;
      const wrapper = await mountWith(shipped());

      expect(
        (
          wrapper
            .findComponent({ name: 'PortalItemRowsSheet' })
            .props('totals') as { label: string; value: string }[]
        ).map((row) => [row.label, row.value]),
      ).toEqual(read(wrapper).rows);
    });

    it('drops the shipping row without a fee', async () => {
      expect(
        (await mountWith(shipped()))
          .find('[data-testid="order-summary-shipping"]')
          .exists(),
      ).toBe(true);
      expect(
        (await mountWith(makeQuote()))
          .find('[data-testid="order-summary-shipping"]')
          .exists(),
      ).toBe(false);
    });

    it('carries the value testids the e2e reads', async () => {
      mockShowIncVat.value = false;
      const wrapper = await mountWith(
        shipped({ discount: 62.5, discountExVat: 50 }),
      );

      expect(
        [
          'order-summary-subtotal',
          'order-summary-discount',
          'order-summary-shipping',
          'order-summary-tax',
          'order-summary-total',
          'order-summary-total-inc-vat',
        ].map((id) => wrapper.find(`[data-testid="${id}"]`).text()),
      ).toEqual([
        '160,00 kr',
        'discount.discount-SEK\u00a050.00',
        '80,00 kr',
        '50,00 kr',
        '200,00 kr',
        '250,00 kr',
      ]);
    });
  });

  describe('responses', () => {
    it('sit inside the summary card, under the rows', async () => {
      const wrapper = await mountWith(pending({ requiresConfirmation: true }));
      const card = wrapper.find('[data-testid="order-summary"]');

      for (const id of ['decline-btn', 'accept-btn', 'quote-accept-note']) {
        expect(card.find(`[data-testid="${id}"]`).exists(), id).toBe(true);
      }
      expect(
        card
          .find('[data-testid="order-summary-total"]')
          .element.compareDocumentPosition(
            card.find('[data-testid="accept-btn"]').element,
          ) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('leaves no empty gap in the card when there is nothing to answer', async () => {
      // The card wraps its default slot in a spaced block; without responses
      // or an error the page passes no slot, so the block is not there.
      const actions = (wrapper: Wrapper) =>
        wrapper.find('[data-testid="order-summary"] > div.mt-4.space-y-4');

      expect(actions(await mountWith(pending())).exists()).toBe(true);
      expect(
        actions(await mountWith(makeQuote({ status: 'accepted' }))).exists(),
      ).toBe(true);
      for (const quote of [
        makeQuote({ status: 'accepted', requiresConfirmation: true }),
        makeQuote({ status: 'confirmed' }),
        makeQuote({ status: 'finalized' }),
      ]) {
        expect(actions(await mountWith(quote)).exists(), quote.status).toBe(
          false,
        );
      }
    });

    it('puts the withdraw button inside the summary card', async () => {
      const wrapper = await mountWith(makeQuote({ status: 'requested' }));

      expect(
        wrapper
          .find('[data-testid="order-summary"]')
          .find('[data-testid="quote-withdraw"]')
          .exists(),
      ).toBe(true);
    });

    it('offers only "withdraw" on a sent request', async () => {
      const wrapper = await mountWith(makeQuote({ status: 'requested' }));

      expect(wrapper.find('[data-testid="quote-withdraw"]').text()).toBe(
        'portal.quotations.withdraw',
      );
      expect(wrapper.find('[data-testid="accept-btn"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="decline-btn"]').exists()).toBe(false);
    });

    const confirm = { requiresConfirmation: true };
    const IDS = [
      'quote-withdraw',
      'decline-btn',
      'accept-btn',
      'quote-place-order',
      'quote-accept-note',
    ];

    // Per status, exactly these controls, with this label and note.
    it.each([
      [
        'pending, no confirmation',
        pending(),
        true,
        {
          'decline-btn': 'portal.quotations.decline',
          'accept-btn': 'portal.quotations.accept_and_order',
          'quote-accept-note': 'portal.quotations.note_order',
        },
      ],
      [
        'pending, no confirmation, no order rights',
        pending(),
        false,
        {
          'decline-btn': 'portal.quotations.decline',
          'accept-btn': 'portal.quotations.accept_plain',
        },
      ],
      [
        'pending, confirmation',
        pending(confirm),
        true,
        {
          'decline-btn': 'portal.quotations.decline',
          'accept-btn': 'portal.quotations.accept_confirm',
          'quote-accept-note': 'portal.quotations.note_confirm_order',
        },
      ],
      [
        'pending, confirmation, no order rights',
        pending(confirm),
        false,
        {
          'decline-btn': 'portal.quotations.decline',
          'accept-btn': 'portal.quotations.accept_confirm',
          'quote-accept-note': 'portal.quotations.note_confirm',
        },
      ],
      [
        'accepted, no confirmation',
        makeQuote({ status: 'accepted' }),
        true,
        { 'quote-place-order': 'checkout.place_order' },
      ],
      [
        'accepted, no confirmation, no order rights',
        makeQuote({ status: 'accepted' }),
        false,
        {},
      ],
      [
        'accepted, waiting for confirmation',
        makeQuote({ status: 'accepted', ...confirm }),
        true,
        {},
      ],
      [
        'confirmed',
        makeQuote({ status: 'confirmed', ...confirm }),
        true,
        { 'quote-place-order': 'checkout.place_order' },
      ],
      [
        'confirmed, no order rights',
        makeQuote({ status: 'confirmed', ...confirm }),
        false,
        {},
      ],
      [
        'confirmed without needing it',
        makeQuote({ status: 'confirmed' }),
        true,
        {},
      ],
      [
        'finalized',
        makeQuote({ status: 'finalized', orderId: '1155' }),
        true,
        {},
      ],
    ] as const)(
      'shows exactly its controls: %s',
      async (_, quote, canOrder, expected) => {
        mockCanAccess.mockImplementation(
          (name) => name !== 'orderPlacement' || canOrder,
        );
        const wrapper = await mountWith(quote);

        const shown = Object.fromEntries(
          IDS.filter((id) =>
            wrapper.find(`[data-testid="${id}"]`).exists(),
          ).map((id) => [id, wrapper.find(`[data-testid="${id}"]`).text()]),
        );
        expect(shown).toEqual(expected);
        expect(mockCanAccess).toHaveBeenCalledWith('orderPlacement');
      },
    );

    it('"accept and place order" is a link to the order page: no dialog, no accept', async () => {
      const wrapper = await mountWith(pending());
      const accept = wrapper.find('[data-testid="accept-btn"]');

      expect(accept.find('a').attributes('href')).toBe(
        '/se/en/portal/quotations/q-001/order',
      );
      await accept.trigger('click');
      await flushPromises();

      expect(wrapper.find('[data-testid="quote-action-dialog"]').exists()).toBe(
        false,
      );
      expect(mockAcceptQuote).not.toHaveBeenCalled();
    });

    it.each([
      ['accepted', makeQuote({ status: 'accepted' })],
      ['confirmed', makeQuote({ status: 'confirmed', ...confirm })],
    ])(
      '"place order" on a %s quotation links to the order page',
      async (_, quote) => {
        const wrapper = await mountWith(quote);
        const place = wrapper.find('[data-testid="quote-place-order"]');

        expect(place.find('a').attributes('href')).toBe(
          '/se/en/portal/quotations/q-001/order',
        );
        expect(
          wrapper
            .find('[data-testid="order-summary"]')
            .element.contains(place.element),
        ).toBe(true);
      },
    );

    it.each<QuoteStatus>([
      'request_draft',
      'rejected',
      'canceled',
      'expired',
      'unknown',
    ])('offers no response on %s', async (status) => {
      const wrapper = await mountWith(makeQuote({ status }));

      for (const id of IDS) {
        expect(wrapper.find(`[data-testid="${id}"]`).exists()).toBe(false);
      }
    });

    it.each([
      [
        'withdraw',
        makeQuote({ status: 'requested' }),
        'quote-withdraw',
        'withdraw',
        true,
      ],
      ['decline', pending(), 'decline-btn', 'decline', true],
      [
        'plain accept without order rights',
        pending(),
        'accept-btn',
        'accept_plain',
        false,
        false,
      ],
      [
        'accept with confirmation',
        pending({ requiresConfirmation: true }),
        'accept-btn',
        'accept_confirm',
        false,
        true,
        'accept_confirm_order_body',
      ],
      [
        'accept with confirmation, without order rights',
        pending({ requiresConfirmation: true }),
        'accept-btn',
        'accept_confirm',
        false,
        false,
      ],
    ])(
      'asks first before a %s, and does nothing yet',
      async (_, quote, button, copy, destructive, canOrder = true, body?) => {
        mockCanAccess.mockImplementation(
          (name) => name !== 'orderPlacement' || canOrder,
        );
        const wrapper = await mountWith(quote);
        expect(
          wrapper.find('[data-testid="quote-action-dialog"]').exists(),
        ).toBe(false);

        await wrapper.find(`[data-testid="${button}"]`).trigger('click');

        const dialog = wrapper.find('[data-testid="quote-action-dialog"]');
        const k = (key: string) => `portal.quotations.${key}`;
        expect({
          title: dialog.find('[data-testid="dialog-title"]').text(),
          description: dialog.find('[data-testid="dialog-description"]').text(),
          confirm: dialog.find('[data-testid="quote-action-confirm"]').text(),
          destructive: dialog.attributes('data-destructive'),
        }).toEqual({
          title: k(`${copy}_title`),
          description: k(body ?? `${copy}_body`),
          confirm: k(copy),
          destructive: String(destructive),
        });
        expect(mockAcceptQuote).not.toHaveBeenCalled();
        expect(mockRejectQuote).not.toHaveBeenCalled();
      },
    );

    it('does nothing when the dialog is cancelled', async () => {
      const wrapper = await mountWith(pending());

      await wrapper.find('[data-testid="decline-btn"]').trigger('click');
      await wrapper
        .find('[data-testid="quote-action-cancel"]')
        .trigger('click');
      await flushPromises();

      expect(wrapper.find('[data-testid="quote-action-dialog"]').exists()).toBe(
        false,
      );
      expect(mockRejectQuote).not.toHaveBeenCalled();
      expect(mockAcceptQuote).not.toHaveBeenCalled();
    });

    it.each([
      [
        'withdraw',
        makeQuote({ status: 'requested' }),
        'quote-withdraw',
        'reject',
      ],
      ['decline', pending(), 'decline-btn', 'reject'],
      [
        'accept',
        pending({ requiresConfirmation: true }),
        'accept-btn',
        'accept',
      ],
    ])(
      'sends a confirmed %s once, with the id only',
      async (_, quote, button, call) => {
        const wrapper = await mountWith(quote);

        await answer(wrapper, button);

        const [used, unused] =
          call === 'accept'
            ? [mockAcceptQuote, mockRejectQuote]
            : [mockRejectQuote, mockAcceptQuote];
        expect(used).toHaveBeenCalledTimes(1);
        expect(used).toHaveBeenCalledWith('q-001');
        expect(unused).not.toHaveBeenCalled();
      },
    );

    it('disables the confirm while the answer is on its way', async () => {
      mockIsActionLoading.value = true;
      const wrapper = await mountWith(pending({ requiresConfirmation: true }));

      await wrapper.find('[data-testid="accept-btn"]').trigger('click');

      expect(
        wrapper
          .find('[data-testid="quote-action-dialog"]')
          .attributes('data-pending'),
      ).toBe('true');
    });

    it.each([
      ['accept-btn', 'accepted' as const, mockAcceptQuote],
      ['decline-btn', 'rejected' as const, mockRejectQuote],
    ])(
      'after %s succeeds: shows %s, closes the dialog, drops the buttons',
      async (button, status, call) => {
        call.mockResolvedValueOnce(
          makeQuote({ status, requiresConfirmation: true }),
        );
        const wrapper = await mountWith(
          pending({ requiresConfirmation: true }),
        );

        await answer(wrapper, button);

        expect(wrapper.find('[data-testid="status-badge"]').text()).toBe(
          `portal.quotations.status_${status}`,
        );
        expect(
          wrapper.find('[data-testid="quote-action-dialog"]').exists(),
        ).toBe(false);
        expect(wrapper.find('[data-testid="accept-btn"]').exists()).toBe(false);
        expect(wrapper.find('[data-testid="decline-btn"]').exists()).toBe(
          false,
        );
      },
    );

    it('after a withdraw succeeds the request shows as rejected, without the button', async () => {
      mockRejectQuote.mockResolvedValueOnce(makeQuote({ status: 'rejected' }));
      const wrapper = await mountWith(makeQuote({ status: 'requested' }));

      await answer(wrapper, 'quote-withdraw');

      expect(wrapper.find('[data-testid="status-badge"]').text()).toBe(
        'portal.quotations.status_rejected',
      );
      expect(wrapper.find('[data-testid="quote-withdraw"]').exists()).toBe(
        false,
      );
    });

    it.each([
      ['accept-btn', 'portal.quotations.accept_failed', mockAcceptQuote],
      ['decline-btn', 'portal.quotations.decline_failed', mockRejectQuote],
    ])(
      'after %s fails: stays pending with the buttons and the banner',
      async (button, key, call) => {
        call.mockImplementationOnce(() => {
          mockStoreError.value = key;
          return Promise.resolve(null);
        });
        const wrapper = await mountWith(
          pending({ requiresConfirmation: true }),
        );

        await answer(wrapper, button);

        expect(wrapper.find('[data-testid="status-badge"]').text()).toBe(
          'portal.quotations.status_pending',
        );
        expect(
          wrapper.find('[data-testid="quote-action-dialog"]').exists(),
        ).toBe(false);
        expect(wrapper.find('[data-testid="accept-btn"]').exists()).toBe(true);
        const banner = wrapper.find('[data-testid="action-error"]');
        expect(banner.text()).toBe(key);
        expect(
          wrapper
            .find('[data-testid="order-summary"]')
            .element.contains(banner.element),
        ).toBe(true);
        expect(banner.attributes('role')).toBe('alert');
      },
    );

    it('clears the banner when a second try succeeds', async () => {
      mockAcceptQuote.mockImplementationOnce(() => {
        mockStoreError.value = 'portal.quotations.accept_failed';
        return Promise.resolve(null);
      });
      const wrapper = await mountWith(pending({ requiresConfirmation: true }));

      await answer(wrapper, 'accept-btn');
      expect(wrapper.find('[data-testid="action-error"]').exists()).toBe(true);
      await answer(wrapper, 'accept-btn');

      expect(wrapper.find('[data-testid="action-error"]').exists()).toBe(false);
    });

    it('clears a stale store error on mount', async () => {
      mockStoreError.value = 'portal.quotations.accept_failed';
      const wrapper = await mountWith(pending());

      expect(wrapper.find('[data-testid="action-error"]').exists()).toBe(false);
    });
  });

  describe('details', () => {
    it('lists the rows in the prototype order, only those with a value', async () => {
      const wrapper = await mountWith(
        makeQuote({
          seller: { name: 'Sam Seller', phone: '+4670000' },
          acceptedAt: '2026-10-28T09:00:00Z',
          acceptedBy: 'Bo Buyer',
          status: 'accepted',
        }),
      );

      expect(metaKeys(wrapper)).toEqual([
        'reference',
        'created',
        'status',
        'expires',
        'terms',
        'accepted',
        'contact',
      ]);
    });

    it('leaves out a row without a value', async () => {
      const wrapper = await mountWith(
        makeQuote({
          quoteNumber: '',
          expiresAt: undefined,
          paymentTerms: undefined,
        }),
      );

      expect(metaKeys(wrapper)).toEqual(['created', 'status']);
    });

    it('keeps the testids the e2e and the old view used', async () => {
      const wrapper = await mountWith(
        makeQuote({ seller: { name: 'Sam Seller' } }),
      );

      for (const id of [
        'quote-reference',
        'expires-at',
        'payment-terms',
        'sale-contact',
      ]) {
        expect(wrapper.find(`[data-testid="${id}"]`).exists()).toBe(true);
      }
      expect(wrapper.find('[data-testid="quote-reference"]').text()).toContain(
        'REF: QUO-2026-001',
      );
    });

    it('names the seller and their phone, never the buyer', async () => {
      const wrapper = await mountWith(
        makeQuote({
          contactName: 'Jane Buyer',
          contactEmail: 'jane@buyer.test',
          seller: { name: 'Sam Seller', phone: '+4670000' },
        }),
      );

      const contact = wrapper.find('[data-testid="sale-contact"]');
      expect(contact.text()).toContain('portal.quotations.sale_contact');
      expect(contact.text()).toContain('Sam Seller');
      expect(contact.text()).toContain('+4670000');
      expect(contact.text()).not.toContain('Jane Buyer');
      expect(contact.text()).not.toContain('jane@buyer.test');
    });

    it('has no contact row without a seller', async () => {
      const wrapper = await mountWith(
        makeQuote({ contactName: 'Jane Buyer', seller: undefined }),
      );

      expect(wrapper.find('[data-testid="sale-contact"]').exists()).toBe(false);
    });

    it('says when and by whom it was accepted, only once the API says so', async () => {
      const without = await mountWith(makeQuote({ status: 'accepted' }));
      expect(without.find('[data-testid="quote-meta-accepted"]').exists()).toBe(
        false,
      );

      const withIt = await mountWith(
        makeQuote({
          status: 'accepted',
          acceptedAt: '2026-10-28T09:00:00Z',
          acceptedBy: 'Bo Buyer',
        }),
      );
      const row = withIt.find('[data-testid="quote-meta-accepted"]');
      expect(row.text()).toContain('portal.quotations.accepted_at');
      expect(row.text()).toContain('Bo Buyer');
      expect(row.text()).toMatch(/2026/);
    });

    it.each([
      ['pending', {}, 'status_info_pending'],
      ['requested', {}, 'status_info_requested'],
      ['accepted', {}, 'status_info_accepted_plain_order'],
      [
        'accepted',
        { requiresConfirmation: true },
        'status_info_accepted_confirm',
      ],
      ['confirmed', {}, 'status_info_confirmed'],
    ] as const)(
      'explains a %s quotation in the status row (%j)',
      async (status, overrides, key) => {
        const wrapper = await mountWith(makeQuote({ status, ...overrides }));

        const row = wrapper.find('[data-testid="quote-meta-status"]');
        expect(row.text()).toContain('portal.quotations.status_label');
        expect(row.findAll('p')[1]!.text()).toBe(`portal.quotations.${key}`);
      },
    );

    it.each([
      ['accepted', {}, 'status_info_accepted_plain'],
      ['confirmed', { requiresConfirmation: true }, 'status_info_confirmed'],
    ] as const)(
      'tells a buyer who can order a %s quotation that they can, and no one else',
      async (status, overrides, key) => {
        const text = async (canOrder: boolean) => {
          mockCanAccess.mockImplementation(
            (name) => name !== 'orderPlacement' || canOrder,
          );
          const wrapper = await mountWith(makeQuote({ status, ...overrides }));
          return wrapper
            .find('[data-testid="quote-meta-status"]')
            .findAll('p')[1]!
            .text();
        };

        expect(await text(true)).toBe(`portal.quotations.${key}_order`);
        expect(await text(false)).toBe(`portal.quotations.${key}`);
      },
    );

    describe('the order it was finalized into', () => {
      const finalized = (overrides: Partial<Quote> = {}) =>
        makeQuote({
          status: 'finalized',
          orderId: '1155',
          orderPublicId: 'pub-1155',
          acceptedAt: '2026-10-28T09:00:00Z',
          seller: { name: 'Sam Seller' },
          ...overrides,
        });
      const orderRow = (wrapper: Wrapper) =>
        wrapper.find('[data-testid="quote-meta-order"]');

      it('comes after the acceptance and before the seller', async () => {
        const keys = metaKeys(await mountWith(finalized()));

        expect(keys.slice(keys.indexOf('accepted'))).toEqual([
          'accepted',
          'order',
          'contact',
        ]);
      });

      it('links the order number to the order', async () => {
        const row = orderRow(await mountWith(finalized()));

        expect(row.text()).toContain('portal.quotations.order_row');
        const link = row.find('[data-testid="quote-meta-order-link"]');
        expect(link.text()).toBe('#1155');
        expect(link.attributes('href')).toBe('/se/en/portal/orders/pub-1155');
        expect(mockCanAccess).toHaveBeenCalledWith('orderHistory');
      });

      it('shows the number without a link to a buyer without order history', async () => {
        mockCanAccess.mockImplementation((name) => name !== 'orderHistory');

        const row = orderRow(await mountWith(finalized()));

        expect(row.text()).toContain('#1155');
        expect(row.find('a').exists()).toBe(false);
      });

      it('shows the number without a link while the order is not readable', async () => {
        const row = orderRow(
          await mountWith(finalized({ orderPublicId: undefined })),
        );

        expect(row.text()).toContain('#1155');
        expect(row.find('a').exists()).toBe(false);
      });

      it('has no order row without an order', async () => {
        const wrapper = await mountWith(
          finalized({ orderId: undefined, orderPublicId: undefined }),
        );

        expect(orderRow(wrapper).exists()).toBe(false);
      });
    });

    it('has no status row on a request draft', async () => {
      const wrapper = await mountWith(makeQuote({ status: 'request_draft' }));

      expect(wrapper.find('[data-testid="quote-meta-status"]').exists()).toBe(
        false,
      );
    });

    describe('what the buyer sent', () => {
      const SENT = {
        customerOrderNumber: 'PO-7781',
        desiredDeliveryDate: '2026-12-09',
        goodsLabel: 'Lastbrygga B',
        comment: 'Leverans till lager 2\nPorten på baksidan',
      };
      const row = (wrapper: Wrapper, id: string) =>
        wrapper.find(`[data-testid="quote-meta-${id}"]`);

      it('adds the four rows after the status, in the prototype order', async () => {
        const wrapper = await mountWith(
          makeQuote({ status: 'requested', request: SENT }),
        );

        expect(metaKeys(wrapper)).toEqual([
          'reference',
          'created',
          'status',
          'your-reference',
          'desired-date',
          'goods-label',
          'comment',
          'expires',
          'terms',
        ]);
      });

      it('labels each row and shows what was sent', async () => {
        const wrapper = await mountWith(
          makeQuote({ status: 'pending', request: SENT }),
        );

        expect(row(wrapper, 'your-reference').text()).toBe(
          'portal.quotations.your_reference' + 'PO-7781',
        );
        expect(row(wrapper, 'goods-label').text()).toBe(
          'portal.quotations.goods_label' + 'Lastbrygga B',
        );
        expect(row(wrapper, 'comment').text()).toBe(
          'portal.quotations.comment' + SENT.comment,
        );
        const date = row(wrapper, 'desired-date');
        expect(date.text()).toContain('portal.quotations.desired_date');
        // A calendar day: the same day in every timezone, never the one before.
        expect(date.text()).toMatch(/2026/);
        expect(date.text()).toMatch(/\b9\b/);
        expect(date.text()).not.toMatch(/\b8\b/);
      });

      it('gives each row its own icon', async () => {
        const wrapper = await mountWith(
          makeQuote({ status: 'requested', request: SENT }),
        );

        const iconOf = (key: string) =>
          wrapper
            .findAllComponents({ name: 'PortalMetaRow' })
            .find((row) => row.props('rowKey') === key)
            ?.props('icon');
        expect(iconOf('your-reference')).toBe(Hash);
        expect(iconOf('desired-date')).toBe(Truck);
        expect(iconOf('goods-label')).toBe(Tag);
        expect(iconOf('comment')).toBe(MessageSquare);
      });

      it('shows only the ones that are set', async () => {
        const wrapper = await mountWith(
          makeQuote({
            status: 'requested',
            request: { desiredDeliveryDate: '2026-12-09', comment: 'Hej' },
          }),
        );

        expect(metaKeys(wrapper)).toEqual([
          'reference',
          'created',
          'status',
          'desired-date',
          'comment',
          'expires',
          'terms',
        ]);
      });

      it.each([
        ['no request', undefined],
        ['an empty request', {}],
      ])('adds none with %s', async (_label, request) => {
        const wrapper = await mountWith(
          makeQuote({ status: 'requested', request }),
        );

        expect(metaKeys(wrapper)).toEqual([
          'reference',
          'created',
          'status',
          'expires',
          'terms',
        ]);
      });

      it('adds none on a request draft', async () => {
        const wrapper = await mountWith(
          makeQuote({ status: 'request_draft', request: SENT }),
        );

        for (const id of [
          'your-reference',
          'desired-date',
          'goods-label',
          'comment',
        ]) {
          expect(row(wrapper, id).exists()).toBe(false);
        }
      });
    });
  });

  describe('customer and addresses', () => {
    it('is collapsed, with company and delivery address on one line', async () => {
      const wrapper = await mountWith(
        makeQuote({
          company: { name: 'Acme Corp' },
          shippingAddress: { addressLine1: 'Street 1', city: 'Stockholm' },
        }),
      );

      expect(wrapper.find('[data-testid="customer-info"]').exists()).toBe(
        false,
      );
      expect(wrapper.find('[data-testid="customer-card-summary"]').text()).toBe(
        'Acme Corp · portal.quotations.delivery_short',
      );
      expect(tSpy).toHaveBeenCalledWith('portal.quotations.delivery_short', {
        address: 'Street 1, Stockholm',
      });
    });

    it('opens to the customer and both addresses', async () => {
      const wrapper = await mountWith(
        makeQuote({
          company: {
            name: 'Acme Corp',
            companyId: 'internal-7',
            vatNumber: '556677-8899',
          },
          billingAddress: { addressLine1: 'Bill 1', city: 'Lund' },
          shippingAddress: { addressLine1: 'Ship 1', city: 'Malmö' },
        }),
      );

      await openCustomerCard(wrapper);

      const info = wrapper.find('[data-testid="customer-info"]');
      expect(info.text()).toContain('Acme Corp');
      expect(wrapper.find('[data-testid="customer-org-number"]').text()).toBe(
        'checkout.vat_number: 556677-8899',
      );
      expect(info.text()).not.toContain('internal-7');
      expect(info.text()).not.toContain('portal.quotations.org_number');
      expect(wrapper.find('[data-testid="invoice-address"]').text()).toContain(
        'Bill 1',
      );
      expect(wrapper.find('[data-testid="delivery-address"]').text()).toContain(
        'Ship 1',
      );
    });

    it('has no org number row when the company has no org number', async () => {
      const wrapper = await mountWith(
        makeQuote({ company: { name: 'Acme Corp', companyId: 'internal-7' } }),
      );

      await openCustomerCard(wrapper);

      expect(wrapper.find('[data-testid="customer-org-number"]').exists()).toBe(
        false,
      );
      expect(
        wrapper.find('[data-testid="customer-info"]').text(),
      ).not.toContain('internal-7');
    });

    it('is not there without a company or an address', async () => {
      const wrapper = await mountWith(
        makeQuote({
          company: undefined,
          billingAddress: undefined,
          shippingAddress: undefined,
        }),
      );

      expect(wrapper.find('[data-testid="customer-info-card"]').exists()).toBe(
        false,
      );
    });
  });

  describe('store seeding', () => {
    it('seeds the quotes store currentQuote from the fetch result', async () => {
      const quote = makeQuote({ id: 'q-001' });
      await mountWith(quote);

      expect(mockStoreCurrentQuote.value).toEqual(quote);
    });
  });
});
