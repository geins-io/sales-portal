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
  await import('../../../app/pages/portal/quotations/[id].vue');

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
const monitorLinked = { system: 'Monitor', number: 'M-1001' };

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

    it('renders every line in the desktop table', async () => {
      const wrapper = await mountWith(twoLines());

      const table = wrapper.find('[data-testid="line-items-table"]');
      const rows = table.findAll('[data-testid="line-item-row"]');
      expect(rows.map((row) => row.text())).toEqual([
        expect.stringContaining('Widget Pro'),
        expect.stringContaining('Gadget Plus'),
      ]);
      expect(rows[0]!.text()).toContain('ART-001');
      expect(rows[0]!.find('[data-testid="line-item-quantity"]').text()).toBe(
        '2',
      );
    });

    it('renders every line as a card for small screens, with the same numbers', async () => {
      const wrapper = await mountWith(twoLines());

      const cards = wrapper.findAll('[data-testid="line-item-card"]');
      expect(
        cards.map((card) => [
          card.find('[data-testid="line-item-card-quantity"]').text(),
          card.find('[data-testid="line-item-card-unit-price"]').text(),
          card.find('[data-testid="line-item-card-total-price"]').text(),
        ]),
      ).toEqual([
        ['2', '100,00 kr', '200,00 kr'],
        ['1', '50,00 kr', '50,00 kr'],
      ]);
      expect(cards[1]!.text()).toContain('ART-002');
    });

    it('splits the two at md, as the prototype does', async () => {
      const wrapper = await mountWith(makeQuote());

      expect(
        wrapper.find('[data-testid="line-items-desktop"]').classes(),
      ).toEqual(expect.arrayContaining(['hidden', 'md:block']));
      expect(
        wrapper.find('[data-testid="line-item-cards"]').classes(),
      ).toContain('md:hidden');
    });

    it('no longer opens the lines in a sheet', async () => {
      const wrapper = await mountWith(makeQuote());

      expect(
        wrapper.findComponent({ name: 'PortalItemRowsSheet' }).exists(),
      ).toBe(false);
    });

    it('links a line with an alias to its product and leaves the others plain', async () => {
      const wrapper = await mountWith(twoLines());

      const links = wrapper.findAll('[data-testid="line-item-name-link"]');
      expect(links.every((link) => link.text() === 'Gadget Plus')).toBe(true);
      expect(links.length).toBeGreaterThan(0);
      expect(wrapper.findAll('[data-testid="line-item-name"]')[0]!.text()).toBe(
        'Widget Pro',
      );
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

        expect([
          wrapper.find('[data-testid="line-item-unit-price"]').text(),
          wrapper.find('[data-testid="line-item-total-price"]').text(),
          wrapper.find('[data-testid="line-item-card-unit-price"]').text(),
          wrapper.find('[data-testid="line-item-card-total-price"]').text(),
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
      const card = wrapper.find('[data-testid="quote-summary-card"]').element;
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

    function read(wrapper: Wrapper) {
      const card = wrapper.find('[data-testid="quote-summary-card"]');
      return {
        lead: [
          card.find('[data-testid="quote-summary-lead-label"]').text(),
          card.find('[data-testid="quote-summary-subtotal"]').text(),
        ],
        rows: card
          .findAll('[data-summary-row]')
          .map((row) => [
            row.attributes('data-summary-row'),
            row.find('dt').text(),
            row.find('dd').text(),
          ]),
      };
    }

    it('leads with the subtotal inc VAT, then the rows, when inc is chosen', async () => {
      mockShowIncVat.value = true;
      expect(read(await mountWith(shipped()))).toEqual({
        lead: ['portal.quotations.sum_inc_vat', '200,00 kr'],
        rows: [
          ['count', 'portal.quotations.items_count', '1'],
          ['shipping', 'portal.quotations.shipping', '100,00 kr'],
          ['tax', 'common.vat_included', '50,00 kr'],
          ['total', 'portal.quotations.grand_total', '250,00 kr'],
        ],
      });
    });

    it('leads with the subtotal ex VAT and ends on the inc total, when ex is chosen', async () => {
      mockShowIncVat.value = false;
      expect(read(await mountWith(shipped()))).toEqual({
        lead: ['portal.quotations.sum_ex_vat', '160,00 kr'],
        rows: [
          ['count', 'portal.quotations.items_count', '1'],
          ['shipping', 'portal.quotations.shipping', '80,00 kr'],
          ['tax', 'common.vat', '50,00 kr'],
          ['total', 'portal.quotations.grand_total', '200,00 kr'],
          ['total-inc-vat', 'common.total_inc_vat', '250,00 kr'],
        ],
      });
    });

    it.each([
      [true, 'SEK 62.50'],
      [false, 'SEK 50.00'],
    ])(
      "shows the seller's percent discount with its rate (incl. VAT: %s)",
      async (incVat, amount) => {
        mockShowIncVat.value = incVat;
        tSpy.mockClear();
        const wrapper = await mountWith(
          makeQuote({ discount: 62.5, discountExVat: 50, discountPercent: 5 }),
        );

        expect(read(wrapper).rows[1]).toEqual([
          'discount',
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

    it('keeps the shipping-row testid on the shipping row, and drops the row without a fee', async () => {
      expect(
        (await mountWith(shipped()))
          .find('[data-testid="shipping-row"]')
          .exists(),
      ).toBe(true);
      expect(
        (await mountWith(makeQuote()))
          .find('[data-testid="shipping-row"]')
          .exists(),
      ).toBe(false);
    });

    it('keeps the value testids the e2e reads', async () => {
      mockShowIncVat.value = false;
      const wrapper = await mountWith(
        shipped({ discount: 62.5, discountExVat: 50 }),
      );

      expect(
        [
          'quote-summary-subtotal',
          'quote-summary-discount',
          'quote-summary-shipping',
          'quote-summary-tax',
          'quote-summary-total',
          'quote-summary-total-inc-vat',
        ].map((id) => wrapper.find(`[data-testid="${id}"]`).text()),
      ).toEqual([
        '160,00 kr',
        '-SEK 50.00',
        '80,00 kr',
        '50,00 kr',
        '200,00 kr',
        '250,00 kr',
      ]);
    });
  });

  describe('responses', () => {
    it('offers only "withdraw" on a sent request', async () => {
      const wrapper = await mountWith(makeQuote({ status: 'requested' }));

      expect(wrapper.find('[data-testid="quote-withdraw"]').text()).toBe(
        'portal.quotations.withdraw',
      );
      expect(wrapper.find('[data-testid="accept-btn"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="decline-btn"]').exists()).toBe(false);
    });

    it.each([
      ['no confirmation', {}, 'portal.quotations.accept_plain', undefined],
      [
        'confirmation',
        { requiresConfirmation: true },
        'portal.quotations.accept_confirm',
        'portal.quotations.note_confirm',
      ],
      [
        'Monitor-linked',
        { externalReference: monitorLinked },
        'portal.quotations.accept_monitor',
        'portal.quotations.note_monitor',
      ],
    ])(
      'offers decline and accept on a pending quotation (%s)',
      async (_, overrides, acceptLabel, note) => {
        const wrapper = await mountWith(pending(overrides));

        expect(wrapper.find('[data-testid="decline-btn"]').text()).toBe(
          'portal.quotations.decline',
        );
        expect(wrapper.find('[data-testid="accept-btn"]').text()).toBe(
          acceptLabel,
        );
        const noteEl = wrapper.find('[data-testid="quote-accept-note"]');
        expect(noteEl.exists() ? noteEl.text() : undefined).toBe(note);
        expect(wrapper.find('[data-testid="quote-withdraw"]').exists()).toBe(
          false,
        );
      },
    );

    it('never promises an order on the accept button', async () => {
      const wrapper = await mountWith(pending());

      expect(wrapper.text()).not.toContain(
        'portal.quotations.accept_and_order',
      );
    });

    it.each<QuoteStatus>([
      'request_draft',
      'accepted',
      'confirmed',
      'finalized',
      'rejected',
      'canceled',
      'expired',
      'unknown',
    ])('offers no response on %s', async (status) => {
      const wrapper = await mountWith(makeQuote({ status }));

      for (const id of ['quote-withdraw', 'decline-btn', 'accept-btn']) {
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
      ['plain accept', pending(), 'accept-btn', 'accept_plain', false],
      [
        'accept with confirmation',
        pending({ requiresConfirmation: true }),
        'accept-btn',
        'accept_confirm',
        false,
      ],
      [
        'Monitor-linked accept',
        pending({ externalReference: monitorLinked }),
        'accept-btn',
        'accept_monitor',
        false,
      ],
    ])(
      'asks first before a %s, and does nothing yet',
      async (_, quote, button, copy, destructive) => {
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
          description: k(`${copy}_body`),
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
      ['withdraw', 'requested' as const, 'quote-withdraw', 'reject'],
      ['decline', 'pending' as const, 'decline-btn', 'reject'],
      ['accept', 'pending' as const, 'accept-btn', 'accept'],
    ])(
      'sends a confirmed %s once, with the id only',
      async (_, status, button, call) => {
        const wrapper = await mountWith(makeQuote({ status }));

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
      const wrapper = await mountWith(pending());

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
        call.mockResolvedValueOnce(makeQuote({ status }));
        const wrapper = await mountWith(pending());

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
        const wrapper = await mountWith(pending());

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
        expect(banner.attributes('role')).toBe('alert');
      },
    );

    it('clears the banner when a second try succeeds', async () => {
      mockAcceptQuote.mockImplementationOnce(() => {
        mockStoreError.value = 'portal.quotations.accept_failed';
        return Promise.resolve(null);
      });
      const wrapper = await mountWith(pending());

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

    // No Monitor-linked quotation exists on the test tenant; this is the proof
    // for that case.
    it('Monitor-linked: accepting says the order is placed, and then says it is on its way', async () => {
      mockAcceptQuote.mockResolvedValueOnce(
        makeQuote({ status: 'accepted', externalReference: monitorLinked }),
      );
      const wrapper = await mountWith(
        pending({
          externalReference: monitorLinked,
          requiresConfirmation: true,
        }),
      );

      expect(wrapper.find('[data-testid="accept-btn"]').text()).toBe(
        'portal.quotations.accept_monitor',
      );
      await wrapper.find('[data-testid="accept-btn"]').trigger('click');
      expect(wrapper.find('[data-testid="dialog-title"]').text()).toBe(
        'portal.quotations.accept_monitor_title',
      );
      await wrapper
        .find('[data-testid="quote-action-confirm"]')
        .trigger('click');
      await flushPromises();

      expect(mockAcceptQuote).toHaveBeenCalledWith('q-001');
      expect(
        wrapper.find('[data-testid="quote-meta-status"]').text(),
      ).toContain('portal.quotations.status_info_accepted_monitor');
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
      ['accepted', {}, 'status_info_accepted_plain'],
      [
        'accepted',
        { requiresConfirmation: true },
        'status_info_accepted_confirm',
      ],
      [
        'accepted',
        { externalReference: monitorLinked },
        'status_info_accepted_monitor',
      ],
      ['confirmed', {}, 'status_info_confirmed'],
    ] as const)(
      'explains a %s quotation in the status row (%j)',
      async (status, overrides, key) => {
        const wrapper = await mountWith(makeQuote({ status, ...overrides }));

        const row = wrapper.find('[data-testid="quote-meta-status"]');
        expect(row.text()).toContain('portal.quotations.status_label');
        expect(row.text()).toContain(`portal.quotations.${key}`);
      },
    );

    it('has no status row on a request draft', async () => {
      const wrapper = await mountWith(makeQuote({ status: 'request_draft' }));

      expect(wrapper.find('[data-testid="quote-meta-status"]').exists()).toBe(
        false,
      );
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
          company: { name: 'Acme Corp', companyId: '556', vatNumber: 'SE1' },
          billingAddress: { addressLine1: 'Bill 1', city: 'Lund' },
          shippingAddress: { addressLine1: 'Ship 1', city: 'Malmö' },
        }),
      );

      await openCustomerCard(wrapper);

      const info = wrapper.find('[data-testid="customer-info"]');
      expect(info.text()).toContain('Acme Corp');
      expect(info.text()).toContain('556');
      expect(info.text()).toContain('SE1');
      expect(wrapper.find('[data-testid="invoice-address"]').text()).toContain(
        'Bill 1',
      );
      expect(wrapper.find('[data-testid="delivery-address"]').text()).toContain(
        'Ship 1',
      );
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
