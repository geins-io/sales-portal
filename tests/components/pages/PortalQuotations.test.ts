import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { mountComponent } from '../../utils/component';
import type { QuoteListItem } from '../../../shared/types/quote';
import { makeQuoteListItem as makeQuote } from '../../fixtures/quote';
import { mockShowIncVat } from '../../setup-components';

// Mock useFetch — returns reactive refs
const mockData = ref<{
  quotes: QuoteListItem[];
  total: number;
} | null>(null);
const mockPending = ref(false);
const mockError = ref<Error | null>(null);
const mockRefresh = vi.fn();

const useFetchMock = vi.fn(
  (_url: string | (() => string), _options?: Record<string, unknown>) => ({
    data: mockData,
    pending: mockPending,
    error: mockError,
    refresh: mockRefresh,
  }),
);

vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: Parameters<typeof useFetchMock>) => useFetchMock(...args),
  $fetch: vi.fn(),
}));

vi.stubGlobal('useFetch', useFetchMock);

const mockUpdateDraft = vi.fn();
const mockDeleteDraft = vi.fn();
const mockStoreError = ref<string | null>(null);

vi.mock('../../../app/stores/quotes', () => ({
  useQuotesStore: () => ({
    isSaving: false,
    get error() {
      return mockStoreError.value;
    },
    updateDraft: (...args: unknown[]) => mockUpdateDraft(...args),
    deleteDraft: (...args: unknown[]) => mockDeleteDraft(...args),
  }),
}));
vi.stubGlobal('definePageMeta', vi.fn());

// Import AFTER mocks are set up
const { default: PortalQuotations } =
  await import('../../../app/pages/portal/quotations/index.vue');

const defaultStubs = {
  PortalShell: {
    template: '<div data-testid="portal-shell"><slot /></div>',
  },
  NuxtLink: {
    template: '<a :href="to" v-bind="$attrs"><slot /></a>',
    props: ['to'],
  },
  Icon: {
    template: '<span class="icon" :data-name="name" />',
    props: ['name'],
  },
  // The menu opens on pointer events jsdom does not send; its items are
  // plain buttons here.
  DropdownMenu: { template: '<div><slot /></div>' },
  DropdownMenuTrigger: { template: '<div><slot /></div>' },
  DropdownMenuContent: { template: '<div><slot /></div>' },
  DropdownMenuItem: {
    emits: ['select'],
    template:
      '<button type="button" v-bind="$attrs" @click="$emit(\'select\')"><slot /></button>',
  },
  PortalDialogRenameQuoteDraft: {
    name: 'PortalDialogRenameQuoteDraft',
    props: ['open', 'name', 'pending'],
    emits: ['update:open', 'submit'],
    template:
      '<div v-if="open" data-testid="rename-dialog" :data-name="name" />',
  },
  PortalDialogDeleteQuoteDraft: {
    name: 'PortalDialogDeleteQuoteDraft',
    props: ['open', 'name', 'pending'],
    emits: ['update:open', 'confirm'],
    template:
      '<div v-if="open" data-testid="delete-dialog" :data-name="name" />',
  },
};

type Wrapper = ReturnType<typeof mountComponent>;

/** Reka's tab trigger activates on a left-button mousedown, not on click. */
async function chooseTab(wrapper: Wrapper, filter: string) {
  await wrapper
    .find(`[data-testid="quotations-filter-${filter}"]`)
    .trigger('mousedown', { button: 0 });
}

function counts(wrapper: Wrapper): Record<string, string> {
  return Object.fromEntries(
    ['all', 'drafts', 'requests', 'quotations'].map((f) => [
      f,
      wrapper.find(`[data-testid="quotations-filter-count-${f}"]`).text(),
    ]),
  );
}

// A page left mounted re-renders on every later `mockData` change.
enableAutoUnmount(afterEach);

describe('PortalQuotations page', () => {
  beforeEach(() => {
    mockData.value = null;
    mockPending.value = false;
    mockError.value = null;
    mockShowIncVat.value = true;
    mockRefresh.mockClear();
    useFetchMock.mockClear();
    mockUpdateDraft.mockReset();
    mockDeleteDraft.mockReset();
    mockStoreError.value = null;
  });

  describe('page structure', () => {
    it('renders inside PortalShell', () => {
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="portal-shell"]').exists()).toBe(true);
    });

    it('calls useFetch with /api/quotes', () => {
      mountComponent(PortalQuotations, { global: { stubs: defaultStubs } });
      expect(useFetchMock.mock.calls[0]?.[0]).toBe('/api/quotes');
      expect(useFetchMock.mock.calls[0]?.[1]).toMatchObject({
        dedupe: 'defer',
      });
    });
  });

  describe('loading state', () => {
    it('shows loading state when pending is true', () => {
      mockPending.value = true;
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="quotations-loading"]').exists()).toBe(
        true,
      );
      expect(wrapper.find('[data-testid="quotations-table"]').exists()).toBe(
        false,
      );
    });
  });

  describe('error state', () => {
    it('shows error state when error is present', () => {
      mockError.value = new Error('Network error');
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="quotations-error"]').exists()).toBe(
        true,
      );
    });

    it('calls refresh when retry is clicked', async () => {
      mockError.value = new Error('Network error');
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      await wrapper.find('[data-testid="quotations-retry"]').trigger('click');
      expect(mockRefresh).toHaveBeenCalledOnce();
    });
  });

  describe('empty state', () => {
    it('says the list is empty when there are no quotes at all', () => {
      mockData.value = { quotes: [], total: 0 };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="quotations-empty"]').text()).toBe(
        'portal.quotations.empty.all',
      );
    });

    it('does not show table when there are no quotes', () => {
      mockData.value = { quotes: [], total: 0 };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="quotations-table"]').exists()).toBe(
        false,
      );
    });

    it.each(['drafts', 'requests', 'quotations'] as const)(
      'names the %s tab when it is empty',
      async (filter) => {
        mockData.value = { quotes: [], total: 0 };
        const wrapper = mountComponent(PortalQuotations, {
          global: { stubs: defaultStubs },
        });
        await chooseTab(wrapper, filter);
        expect(wrapper.find('[data-testid="quotations-empty"]').text()).toBe(
          `portal.quotations.empty.${filter}`,
        );
      },
    );

    it('names the empty tab while other tabs have quotes', async () => {
      mockData.value = {
        quotes: [makeQuote({ id: 'q-1', status: 'pending' })],
        total: 1,
      };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      await chooseTab(wrapper, 'drafts');
      expect(wrapper.find('[data-testid="quotations-empty"]').text()).toBe(
        'portal.quotations.empty.drafts',
      );
      expect(wrapper.find('[data-testid="quotations-filter"]').exists()).toBe(
        true,
      );
    });

    it('says nothing matches when a search empties the tab', async () => {
      mockData.value = {
        quotes: [makeQuote({ status: 'request_draft' })],
        total: 1,
      };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      await chooseTab(wrapper, 'drafts');
      await wrapper
        .find('[data-testid="quotations-search"]')
        .setValue('zzz-no-match');
      expect(wrapper.find('[data-testid="quotations-empty"]').text()).toBe(
        'portal.quotations.empty.no_match',
      );
    });

    it('counts a blank search as no search', async () => {
      mockData.value = { quotes: [], total: 0 };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      await wrapper.find('[data-testid="quotations-search"]').setValue('   ');
      expect(wrapper.find('[data-testid="quotations-empty"]').text()).toBe(
        'portal.quotations.empty.all',
      );
    });
  });

  describe('tabs', () => {
    const mixed = () => [
      makeQuote({ id: 'q-p1', quoteNumber: 'Q-P1', status: 'pending' }),
      makeQuote({ id: 'q-d1', quoteNumber: '', status: 'request_draft' }),
      makeQuote({ id: 'q-r1', quoteNumber: 'Q-R1', status: 'requested' }),
      makeQuote({ id: 'q-e1', quoteNumber: 'Q-E1', status: 'expired' }),
      makeQuote({ id: 'q-d2', quoteNumber: '', status: 'request_draft' }),
      makeQuote({ id: 'q-a1', quoteNumber: 'Q-A1', status: 'accepted' }),
    ];

    function rowIds(wrapper: Wrapper) {
      return wrapper
        .find('table')
        .findAll('[data-testid="quotation-row"]')
        .map((row) => row.attributes('data-id'));
    }

    it('shows the four tabs in the prototype order', () => {
      mockData.value = { quotes: mixed(), total: 6 };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const tabs = wrapper
        .find('[data-testid="quotations-filter"]')
        .findAll('[role="tab"]');
      expect(tabs.map((tab) => tab.attributes('data-testid'))).toEqual([
        'quotations-filter-all',
        'quotations-filter-drafts',
        'quotations-filter-requests',
        'quotations-filter-quotations',
      ]);
      expect(tabs[1]!.text()).toContain('portal.quotations.filters.drafts');
    });

    it('uses the underline tab style, as on the product page', () => {
      mockData.value = { quotes: mixed(), total: 6 };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      expect(
        wrapper.find('[data-testid="quotations-filter"]').classes(),
      ).toContain('border-b');
    });

    it('starts on Alla', () => {
      mockData.value = { quotes: mixed(), total: 6 };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      expect(
        wrapper
          .find('[data-testid="quotations-filter-all"]')
          .attributes('aria-selected'),
      ).toBe('true');
      expect(rowIds(wrapper)).toHaveLength(6);
    });

    it('counts each group', () => {
      mockData.value = { quotes: mixed(), total: 6 };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      expect(counts(wrapper)).toEqual({
        all: '6',
        drafts: '2',
        requests: '1',
        quotations: '3',
      });
    });

    it('counts the whole group, not the page', () => {
      mockData.value = {
        quotes: Array.from({ length: 25 }, (_, i) =>
          makeQuote({ id: `q-${i}`, status: 'pending' }),
        ),
        total: 25,
      };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      expect(counts(wrapper)).toEqual({
        all: '25',
        drafts: '0',
        requests: '0',
        quotations: '25',
      });
    });

    it('keeps the counts while a search narrows the rows', async () => {
      mockData.value = { quotes: mixed(), total: 6 };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      await wrapper.find('[data-testid="quotations-search"]').setValue('Q-R1');
      expect(rowIds(wrapper)).toEqual(['q-r1']);
      expect(counts(wrapper).all).toBe('6');
    });

    it.each<[string, () => void]>([
      [
        'loading',
        () => {
          mockPending.value = true;
        },
      ],
      [
        'the read failed',
        () => {
          mockError.value = new Error('Network error');
        },
      ],
    ])('shows no count while %s', (_state, arrange) => {
      arrange();
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="quotations-filter"]').exists()).toBe(
        true,
      );
      expect(
        wrapper.findAll('[data-testid^="quotations-filter-count-"]'),
      ).toHaveLength(0);
    });

    it.each<[string, string[]]>([
      ['drafts', ['q-d1', 'q-d2']],
      ['requests', ['q-r1']],
      ['quotations', ['q-p1', 'q-e1', 'q-a1']],
    ])('shows only its own rows on the %s tab', async (filter, ids) => {
      mockData.value = { quotes: mixed(), total: 6 };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      await chooseTab(wrapper, filter);
      expect(
        wrapper
          .find(`[data-testid="quotations-filter-${filter}"]`)
          .attributes('aria-selected'),
      ).toBe('true');
      expect(rowIds(wrapper)).toEqual(ids);
    });

    it('puts drafts first on Alla and keeps the server order otherwise', () => {
      mockData.value = { quotes: mixed(), total: 6 };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      expect(rowIds(wrapper)).toEqual([
        'q-d1',
        'q-d2',
        'q-p1',
        'q-r1',
        'q-e1',
        'q-a1',
      ]);
    });

    it('puts drafts first on the mobile cards too', () => {
      mockData.value = { quotes: mixed(), total: 6 };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const cards = wrapper
        .findAll('[data-testid="quotation-row"]')
        .filter((row) => row.element.tagName === 'A')
        .map((row) => row.attributes('href'));
      expect(cards.slice(0, 3)).toEqual([
        '/se/en/portal/quotations/q-d1',
        '/se/en/portal/quotations/q-d2',
        '/se/en/portal/quotations/q-p1',
      ]);
    });

    it('searches within the chosen tab', async () => {
      mockData.value = { quotes: mixed(), total: 6 };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      await chooseTab(wrapper, 'quotations');
      await wrapper.find('[data-testid="quotations-search"]').setValue('Q-');
      expect(rowIds(wrapper)).toEqual(['q-p1', 'q-e1', 'q-a1']);
      await wrapper.find('[data-testid="quotations-search"]').setValue('Q-R1');
      expect(wrapper.find('table').exists()).toBe(false);
      expect(wrapper.find('[data-testid="quotations-empty"]').text()).toBe(
        'portal.quotations.empty.no_match',
      );
    });

    it('keeps the search when the tab changes', async () => {
      mockData.value = { quotes: mixed(), total: 6 };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      await wrapper.find('[data-testid="quotations-search"]').setValue('Q-R1');
      await chooseTab(wrapper, 'requests');
      expect(rowIds(wrapper)).toEqual(['q-r1']);
    });

    it('goes back to page 1 when the tab changes', async () => {
      mockData.value = {
        quotes: Array.from({ length: 25 }, (_, i) =>
          makeQuote({ id: `q-${i}`, status: 'pending' }),
        ),
        total: 25,
      };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      await wrapper.find('[data-testid="quotations-next"]').trigger('click');
      expect(rowIds(wrapper)).toHaveLength(5);
      await chooseTab(wrapper, 'quotations');
      expect(rowIds(wrapper)).toHaveLength(20);
      expect(rowIds(wrapper)[0]).toBe('q-0');
    });
  });

  describe('table rendering', () => {
    it('renders the table when quotes are present', () => {
      mockData.value = { quotes: [makeQuote()], total: 1 };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="quotations-table"]').exists()).toBe(
        true,
      );
    });

    it('renders a row for each quote', () => {
      mockData.value = {
        quotes: [
          makeQuote({ id: 'q-001', quoteNumber: 'Q-001' }),
          makeQuote({ id: 'q-002', quoteNumber: 'Q-002' }),
          makeQuote({ id: 'q-003', quoteNumber: 'Q-003' }),
        ],
        total: 3,
      };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const rows = wrapper
        .find('table')
        .findAll('[data-testid="quotation-row"]');
      expect(rows).toHaveLength(3);
    });

    it('displays quote number in each row', () => {
      mockData.value = {
        quotes: [makeQuote({ quoteNumber: 'Q-2024-042' })],
        total: 1,
      };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      expect(
        wrapper.find('table').find('[data-testid="quotation-row"]').text(),
      ).toContain('Q-2024-042');
    });

    it('renders em dash when there is no name and quoteNumber is empty string (mobile + desktop)', () => {
      // Pending drafts come back from Geins with an empty string — not null —
      // so the fallback must use || and the rendered character must be U+2014 (—).
      mockData.value = {
        quotes: [makeQuote({ quoteNumber: '' })],
        total: 1,
      };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      // Desktop table row
      const desktopRow = wrapper
        .find('table')
        .find('[data-testid="quotation-row"]');
      expect(desktopRow.exists()).toBe(true);
      expect(desktopRow.text()).toContain('—');

      // Mobile card — NuxtLink is stubbed to <a> and lives under the md:hidden
      // wrapper; jsdom ignores Tailwind breakpoints so both trees exist.
      const allRows = wrapper.findAll('[data-testid="quotation-row"]');
      // One mobile <a> and one desktop <tr>
      expect(allRows.length).toBeGreaterThanOrEqual(2);
      const mobileRow = allRows.find((r) => r.element.tagName === 'A');
      expect(mobileRow).toBeDefined();
      expect(mobileRow!.text()).toContain('—');
    });

    describe('name / no. column', () => {
      it('heads the first column "Namn / nr"', () => {
        mockData.value = { quotes: [makeQuote()], total: 1 };
        const wrapper = mountComponent(PortalQuotations, {
          global: { stubs: defaultStubs },
        });
        expect(wrapper.find('thead th').text()).toBe(
          'portal.quotations.name_number',
        );
      });

      it('shows the name first, bold and linked to the quotation', () => {
        mockData.value = {
          quotes: [makeQuote({ id: 'q-abc', name: 'Varukorg 11 nov. 2026' })],
          total: 1,
        };
        const wrapper = mountComponent(PortalQuotations, {
          global: { stubs: defaultStubs },
        });
        const link = wrapper.find('[data-testid="quotation-name"]');
        expect(link.text()).toBe('Varukorg 11 nov. 2026');
        expect(link.attributes('href')).toBe('/se/en/portal/quotations/q-abc');
        expect(link.classes()).toContain('font-medium');
      });

      it.each<[QuoteListItem['status'], string, string]>([
        ['request_draft', '', 'portal.quotations.kind_request'],
        [
          'requested',
          '2401-1-0001-00',
          'portal.quotations.kind_request · 2401-1-0001-00',
        ],
        [
          'pending',
          '2401-1-0001-00',
          'portal.quotations.kind_quotation · 2401-1-0001-00',
        ],
        [
          'finalized',
          '2401-1-0001-00',
          'portal.quotations.kind_quotation · 2401-1-0001-00',
        ],
      ])(
        'puts the kind and the number under the name for %s, on both layouts',
        (status, quoteNumber, line) => {
          mockData.value = {
            quotes: [makeQuote({ status, quoteNumber, name: 'Name' })],
            total: 1,
          };
          const wrapper = mountComponent(PortalQuotations, {
            global: { stubs: defaultStubs },
          });
          const lines = wrapper.findAll('[data-testid="quotation-kind"]');
          expect(lines.map((l) => l.text())).toEqual([line, line]);
          expect(lines[0]!.classes()).toContain('text-muted-foreground');
        },
      );

      it('shows the name on the mobile card too', () => {
        mockData.value = {
          quotes: [makeQuote({ name: 'Varukorg 11 nov. 2026' })],
          total: 1,
        };
        const wrapper = mountComponent(PortalQuotations, {
          global: { stubs: defaultStubs },
        });
        const card = wrapper
          .findAll('[data-testid="quotation-row"]')
          .find((row) => row.element.tagName === 'A');
        expect(card!.find('p').text()).toBe('Varukorg 11 nov. 2026');
      });

      it('falls back to the number when the quotation has no name', () => {
        mockData.value = {
          quotes: [makeQuote({ quoteNumber: 'Q-2024-042' })],
          total: 1,
        };
        const wrapper = mountComponent(PortalQuotations, {
          global: { stubs: defaultStubs },
        });
        expect(wrapper.find('[data-testid="quotation-name"]').text()).toBe(
          'Q-2024-042',
        );
      });
    });

    it('displays contact name in each row', () => {
      mockData.value = {
        quotes: [makeQuote({ contactName: 'John Smith' })],
        total: 1,
      };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      expect(
        wrapper.find('table').find('[data-testid="quotation-row"]').text(),
      ).toContain('John Smith');
    });

    it('formats the created date using the current i18n locale (not hardcoded sv-SE)', () => {
      // Component tests stub useI18n().locale to 'en' (see setup-components.ts).
      // Expect the en-format numeric date for 2024-03-01, NOT the sv-SE 2024-03-01.
      mockData.value = {
        quotes: [makeQuote({ createdAt: '2024-03-01T10:00:00Z' })],
        total: 1,
      };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const expected = new Date('2024-03-01T10:00:00Z').toLocaleDateString(
        'en',
        {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        },
      );
      expect(
        wrapper.find('table').find('[data-testid="quotation-row"]').text(),
      ).toContain(expected);
    });

    it('displays formatted total in each row', () => {
      mockData.value = {
        quotes: [makeQuote({ totalFormatted: '2 500,00 kr' })],
        total: 1,
      };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      expect(
        wrapper.find('table').find('[data-testid="quotation-row"]').text(),
      ).toContain('2 500,00 kr');
    });

    it('shows each total inc VAT when inc is chosen, on both layouts', () => {
      mockShowIncVat.value = true;
      mockData.value = { quotes: [makeQuote()], total: 1 };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const cells = wrapper
        .findAll('[data-testid="quotation-total"]')
        .map((cell) => cell.text());
      expect(cells).toEqual(['1 500,00 kr', '1 500,00 kr']);
    });

    it('shows each total ex VAT when ex is chosen, on both layouts', () => {
      mockShowIncVat.value = false;
      mockData.value = { quotes: [makeQuote()], total: 1 };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const cells = wrapper
        .findAll('[data-testid="quotation-total"]')
        .map((cell) => cell.text());
      expect(cells).toEqual(['1 200,00 kr', '1 200,00 kr']);
    });

    it('renders a view link for each quote', () => {
      mockData.value = {
        quotes: [makeQuote({ id: 'q-abc' })],
        total: 1,
      };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const link = wrapper.find('[data-testid="quotation-view-link"]');
      expect(link.exists()).toBe(true);
      // B13: links must go through localePath() and include the /{market}/{locale} prefix
      expect(link.attributes('href')).toBe('/se/en/portal/quotations/q-abc');
    });
  });

  describe('status badges', () => {
    const statuses = [
      'request_draft',
      'requested',
      'pending',
      'accepted',
      'confirmed',
      'finalized',
      'rejected',
      'canceled',
      'expired',
      'unknown',
    ] as const;

    for (const status of statuses) {
      it(`renders status badge for ${status}`, () => {
        mockData.value = {
          quotes: [makeQuote({ status })],
          total: 1,
        };
        const wrapper = mountComponent(PortalQuotations, {
          global: { stubs: defaultStubs },
        });
        const badge = wrapper.find('[data-testid="quote-status-badge"]');
        expect(badge.exists()).toBe(true);
        expect(badge.text()).toContain(`portal.quotations.status_${status}`);
      });
    }

    it.each<[QuoteListItem['status'], string]>([
      ['request_draft', 'border-dashed'],
      ['requested', 'bg-neutral-500/10'],
      ['pending', 'bg-info/10'],
      ['accepted', 'bg-success/8'],
      ['confirmed', 'bg-success/8'],
      ['finalized', 'bg-success'],
      ['rejected', 'bg-danger/10'],
      ['canceled', 'bg-danger/10'],
      ['expired', 'bg-warning/10'],
      ['unknown', 'bg-neutral-500/10'],
    ])('paints %s badge with its tone %s', (status, token) => {
      mockData.value = {
        quotes: [makeQuote({ status })],
        total: 1,
      };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const badge = wrapper.find('[data-testid="quote-status-badge"]');
      expect(badge.exists()).toBe(true);
      expect(badge.classes()).toContain(token);
    });

    it('gives expired a distinct palette from pending', () => {
      const classFor = (status: QuoteListItem['status']) => {
        mockData.value = { quotes: [makeQuote({ status })], total: 1 };
        const wrapper = mountComponent(PortalQuotations, {
          global: { stubs: defaultStubs },
        });
        return (
          wrapper
            .find('[data-testid="quote-status-badge"]')
            .attributes('class') ?? ''
        );
      };
      expect(classFor('pending')).not.toBe(classFor('expired'));
    });
  });

  describe('search filtering', () => {
    it('shows all quotes when search is empty', async () => {
      mockData.value = {
        quotes: [
          makeQuote({
            id: 'q-001',
            quoteNumber: 'Q-001',
            contactName: 'Alice',
          }),
          makeQuote({
            id: 'q-002',
            quoteNumber: 'Q-002',
            contactName: 'Bob',
          }),
        ],
        total: 2,
      };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const rows = wrapper
        .find('table')
        .findAll('[data-testid="quotation-row"]');
      expect(rows).toHaveLength(2);
    });

    it('filters quotes by quote number', async () => {
      mockData.value = {
        quotes: [
          makeQuote({ id: 'q-001', quoteNumber: 'Q-2024-001' }),
          makeQuote({ id: 'q-002', quoteNumber: 'Q-2024-002' }),
        ],
        total: 2,
      };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const input = wrapper.find('[data-testid="quotations-search"]');
      await input.setValue('Q-2024-001');
      const rows = wrapper
        .find('table')
        .findAll('[data-testid="quotation-row"]');
      expect(rows).toHaveLength(1);
    });

    it('filters quotes by name', async () => {
      mockData.value = {
        quotes: [
          makeQuote({ id: 'q-001', name: 'Spring order' }),
          makeQuote({ id: 'q-002', name: 'Autumn order' }),
        ],
        total: 2,
      };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const input = wrapper.find('[data-testid="quotations-search"]');
      await input.setValue('Spring');
      const rows = wrapper
        .find('table')
        .findAll('[data-testid="quotation-row"]');
      expect(rows).toHaveLength(1);
      expect(rows[0]!.text()).toContain('Spring order');
    });

    it('does not search the contact name, as in the prototype', async () => {
      mockData.value = {
        quotes: [makeQuote({ name: 'Spring order', contactName: 'Alice' })],
        total: 1,
      };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      await wrapper.find('[data-testid="quotations-search"]').setValue('Alice');
      expect(wrapper.find('[data-testid="quotations-empty"]').exists()).toBe(
        true,
      );
    });

    it('search is case-insensitive', async () => {
      mockData.value = {
        quotes: [makeQuote({ name: 'Spring order' })],
        total: 1,
      };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const input = wrapper.find('[data-testid="quotations-search"]');
      await input.setValue('spring');
      const rows = wrapper
        .find('table')
        .findAll('[data-testid="quotation-row"]');
      expect(rows).toHaveLength(1);
    });

    it('shows empty state when search has no matches', async () => {
      mockData.value = {
        quotes: [makeQuote({ contactName: 'Alice' })],
        total: 1,
      };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const input = wrapper.find('[data-testid="quotations-search"]');
      await input.setValue('zzz-no-match');
      expect(wrapper.find('[data-testid="quotations-empty"]').exists()).toBe(
        true,
      );
      expect(wrapper.find('[data-testid="quotations-table"]').exists()).toBe(
        false,
      );
    });
  });

  describe('pagination', () => {
    function makeQuotes(count: number): QuoteListItem[] {
      return Array.from({ length: count }, (_, i) =>
        makeQuote({
          id: `q-${String(i + 1).padStart(3, '0')}`,
          quoteNumber: `Q-${String(i + 1).padStart(4, '0')}`,
          name: `Request ${i + 1}`,
        }),
      );
    }

    it('does not render pagination controls when quotes fit in one page', () => {
      mockData.value = { quotes: makeQuotes(5), total: 5 };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      expect(
        wrapper.find('[data-testid="quotations-pagination"]').exists(),
      ).toBe(false);
    });

    it('renders pagination controls when quotes exceed page size', () => {
      mockData.value = { quotes: makeQuotes(25), total: 25 };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      expect(
        wrapper.find('[data-testid="quotations-pagination"]').exists(),
      ).toBe(true);
    });

    it('first page renders exactly 20 rows when there are 25 quotes', () => {
      mockData.value = { quotes: makeQuotes(25), total: 25 };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const rows = wrapper
        .find('table')
        .findAll('[data-testid="quotation-row"]');
      expect(rows).toHaveLength(20);
    });

    it('clicking Next advances to page 2 and renders remaining 5 rows', async () => {
      mockData.value = { quotes: makeQuotes(25), total: 25 };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      await wrapper.find('[data-testid="quotations-next"]').trigger('click');
      const rows = wrapper
        .find('table')
        .findAll('[data-testid="quotation-row"]');
      expect(rows).toHaveLength(5);
    });

    it('clicking Previous goes back to page 1', async () => {
      mockData.value = { quotes: makeQuotes(25), total: 25 };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      await wrapper.find('[data-testid="quotations-next"]').trigger('click');
      await wrapper
        .find('[data-testid="quotations-previous"]')
        .trigger('click');
      const rows = wrapper
        .find('table')
        .findAll('[data-testid="quotation-row"]');
      expect(rows).toHaveLength(20);
    });

    it('renders count summary with shown and total on page 1', () => {
      mockData.value = { quotes: makeQuotes(25), total: 25 };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const summary = wrapper.find('[data-testid="quotations-count"]');
      expect(summary.exists()).toBe(true);
      expect(summary.attributes('data-shown')).toBe('20');
      expect(summary.attributes('data-total')).toBe('25');
    });

    it('count summary updates when navigating to last page', async () => {
      mockData.value = { quotes: makeQuotes(25), total: 25 };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      await wrapper.find('[data-testid="quotations-next"]').trigger('click');
      const summary = wrapper.find('[data-testid="quotations-count"]');
      expect(summary.attributes('data-shown')).toBe('5');
      expect(summary.attributes('data-total')).toBe('25');
    });

    it('resets to page 1 when search query changes', async () => {
      mockData.value = { quotes: makeQuotes(25), total: 25 };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      // Navigate to page 2
      await wrapper.find('[data-testid="quotations-next"]').trigger('click');
      // Search filters to a single match AND should reset page to 1
      const input = wrapper.find('[data-testid="quotations-search"]');
      await input.setValue('Q-0001');
      const rows = wrapper
        .find('table')
        .findAll('[data-testid="quotation-row"]');
      expect(rows).toHaveLength(1);
      expect(rows[0]!.text()).toContain('Q-0001');
      // Pagination hidden (only 1 result)
      expect(
        wrapper.find('[data-testid="quotations-pagination"]').exists(),
      ).toBe(false);
    });

    it('clamps currentPage when filtered results shrink below it', async () => {
      mockData.value = { quotes: makeQuotes(25), total: 25 };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      // Navigate to page 2 (has 5 rows)
      await wrapper.find('[data-testid="quotations-next"]').trigger('click');
      // Filter to something that only matches a single page-1 item —
      // search watcher should reset to page 1 so we don't show an empty page
      const input = wrapper.find('[data-testid="quotations-search"]');
      await input.setValue('Request 3');
      const rows = wrapper
        .find('table')
        .findAll('[data-testid="quotation-row"]');
      // "Request 3" matches Request 3, 30, 31, ..., 39 → within 20 rows on page 1
      expect(rows.length).toBeGreaterThan(0);
    });
  });
  describe('sum column', () => {
    it('right-aligns the sum, as in the prototype', () => {
      mockData.value = { quotes: [makeQuote()], total: 1 };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const th = wrapper.findAll('thead th')[3]!;
      expect(th.text()).toBe('portal.quotations.total');
      expect(th.classes()).toContain('text-right');
      const desktopTotal = wrapper.find(
        'table [data-testid="quotation-total"]',
      );
      expect(desktopTotal.element.closest('td')!.classList).toContain(
        'text-right',
      );
    });

    it.each<[QuoteListItem['status'], boolean]>([
      ['request_draft', true],
      ['requested', true],
      ['pending', false],
      ['finalized', false],
    ])('marks the sum as estimated for %s: %s', (status, estimate) => {
      mockData.value = { quotes: [makeQuote({ status })], total: 1 };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      expect(
        wrapper.find('table [data-testid="quotation-estimate"]').exists(),
      ).toBe(estimate);
      if (estimate) {
        expect(
          wrapper.find('table [data-testid="quotation-estimate"]').text(),
        ).toBe('portal.quotations.estimate_short');
      }
      const card = wrapper
        .findAll('[data-testid="quotation-row"]')
        .find((row) => row.element.tagName === 'A')!;
      expect(card.text().includes('≈')).toBe(estimate);
    });

    it('keeps the amount itself free of the marker', () => {
      mockData.value = {
        quotes: [makeQuote({ status: 'requested' })],
        total: 1,
      };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      expect(
        wrapper.findAll('[data-testid="quotation-total"]').map((c) => c.text()),
      ).toEqual(['1 500,00 kr', '1 500,00 kr']);
    });
  });

  describe('draft rows', () => {
    const draft = () =>
      makeQuote({ id: 'q-d1', status: 'request_draft', name: 'Etapp 2' });

    function mountWith(quotes: QuoteListItem[]) {
      mockData.value = { quotes, total: quotes.length };
      return mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
    }

    it('continues a draft where it is edited, and views anything else', () => {
      const wrapper = mountWith([
        draft(),
        makeQuote({ id: 'q-p1', status: 'pending' }),
      ]);
      const [draftRow, otherRow] = wrapper
        .find('table')
        .findAll('[data-testid="quotation-row"]');
      const cont = draftRow!.find('[data-testid="quotation-continue"]');
      expect(cont.attributes('href')).toBe('/se/en/portal/quotations/q-d1');
      expect(cont.text()).toContain('portal.quotations.continue');
      expect(
        draftRow!.find('[data-testid="quotation-view-link"]').exists(),
      ).toBe(false);
      expect(
        otherRow!.find('[data-testid="quotation-view-link"]').exists(),
      ).toBe(true);
      expect(otherRow!.find('[data-testid="quotation-more"]').exists()).toBe(
        false,
      );
    });

    it('names the draft in the menu button', () => {
      const wrapper = mountWith([draft()]);
      const more = wrapper.find('table [data-testid="quotation-more"]');
      expect(more.attributes('aria-label')).toBe(
        'portal.quotations.draft.more',
      );
    });

    it('gives the mobile draft card Fortsätt, Byt namn and Radera', () => {
      const wrapper = mountWith([
        draft(),
        makeQuote({ id: 'q-p1', status: 'pending' }),
      ]);
      const cards = wrapper.findAll('[data-testid="quotation-card"]');
      expect(cards).toHaveLength(2);
      expect(
        cards[0]!
          .find('[data-testid="quotation-card-continue"]')
          .attributes('href'),
      ).toBe('/se/en/portal/quotations/q-d1');
      expect(
        cards[0]!.find('[data-testid="quotation-card-rename"]').exists(),
      ).toBe(true);
      expect(
        cards[0]!.find('[data-testid="quotation-card-delete"]').exists(),
      ).toBe(true);
      expect(
        cards[1]!.find('[data-testid="quotation-card-continue"]').exists(),
      ).toBe(false);
    });

    it.each([
      'table [data-testid="quotation-rename"]',
      '[data-testid="quotation-card-rename"]',
    ])(
      'renames a draft from %s and shows the name Geins answers with',
      async (from) => {
        mockUpdateDraft.mockResolvedValueOnce({ id: 'q-d1', name: 'Etapp 3' });
        const wrapper = mountWith([draft()]);
        await wrapper.find(from).trigger('click');
        const dialog = wrapper.findComponent({
          name: 'PortalDialogRenameQuoteDraft',
        });
        expect(dialog.props('open')).toBe(true);
        expect(dialog.props('name')).toBe('Etapp 2');

        dialog.vm.$emit('submit', 'Etapp 3');
        await flushPromises();

        expect(mockUpdateDraft).toHaveBeenCalledWith('q-d1', {
          name: 'Etapp 3',
        });
        expect(wrapper.find('[data-testid="rename-dialog"]').exists()).toBe(
          false,
        );
        expect(wrapper.find('[data-testid="quotation-name"]').text()).toBe(
          'Etapp 3',
        );
        expect(mockRefresh).not.toHaveBeenCalled();
      },
    );

    it('keeps the dialog open and says so when the rename fails', async () => {
      mockUpdateDraft.mockImplementationOnce(async () => {
        mockStoreError.value = 'portal.quotations.draft.save_failed';
        return null;
      });
      const wrapper = mountWith([draft()]);
      await wrapper
        .find('table [data-testid="quotation-rename"]')
        .trigger('click');
      wrapper
        .findComponent({ name: 'PortalDialogRenameQuoteDraft' })
        .vm.$emit('submit', 'Etapp 3');
      await flushPromises();

      expect(wrapper.find('[data-testid="rename-dialog"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="quotation-name"]').text()).toBe(
        'Etapp 2',
      );
      expect(
        wrapper.find('[data-testid="quotations-write-error"]').text(),
      ).toBe('portal.quotations.draft.save_failed');
    });

    it.each([
      'table [data-testid="quotation-delete"]',
      '[data-testid="quotation-card-delete"]',
    ])(
      'deletes a draft from %s after the confirm, and the list and counts follow',
      async (from) => {
        mockDeleteDraft.mockResolvedValueOnce(true);
        const wrapper = mountWith([
          draft(),
          makeQuote({ id: 'q-p1', status: 'pending' }),
        ]);
        await wrapper.find(from).trigger('click');
        const dialog = wrapper.findComponent({
          name: 'PortalDialogDeleteQuoteDraft',
        });
        expect(dialog.props('open')).toBe(true);
        expect(dialog.props('name')).toBe('Etapp 2');

        dialog.vm.$emit('confirm');
        await flushPromises();

        expect(mockDeleteDraft).toHaveBeenCalledWith('q-d1');
        expect(wrapper.find('[data-testid="delete-dialog"]').exists()).toBe(
          false,
        );
        expect(
          wrapper
            .find('table')
            .findAll('[data-testid="quotation-row"]')
            .map((r) => r.attributes('data-id')),
        ).toEqual(['q-p1']);
        expect(counts(wrapper)).toMatchObject({ all: '1', drafts: '0' });
      },
    );

    it('keeps the draft and says so when the delete fails', async () => {
      mockDeleteDraft.mockImplementationOnce(async () => {
        mockStoreError.value = 'portal.quotations.draft.delete_failed';
        return false;
      });
      const wrapper = mountWith([draft()]);
      await wrapper
        .find('table [data-testid="quotation-delete"]')
        .trigger('click');
      wrapper
        .findComponent({ name: 'PortalDialogDeleteQuoteDraft' })
        .vm.$emit('confirm');
      await flushPromises();

      expect(wrapper.find('[data-testid="delete-dialog"]').exists()).toBe(true);
      expect(wrapper.find('table [data-testid="quotation-row"]').exists()).toBe(
        true,
      );
      expect(
        wrapper.find('[data-testid="quotations-write-error"]').text(),
      ).toBe('portal.quotations.draft.delete_failed');
    });

    it('shows no write error from an earlier page', () => {
      mockStoreError.value = 'portal.quotations.accept_failed';
      const wrapper = mountWith([draft()]);
      expect(
        wrapper.find('[data-testid="quotations-write-error"]').exists(),
      ).toBe(false);
    });
  });
});
