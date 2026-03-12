import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reactive } from 'vue';
import { mountComponent } from '../../utils/component';
import PortalQuotations from '../../../app/pages/portal/quotations.vue';
import type { QuoteListItem } from '../../../shared/types/quote';

// Use reactive so refs inside auto-unwrap in template (mirrors real Pinia store behaviour)
const mockStore = reactive({
  quotes: [] as QuoteListItem[],
  isLoading: false,
  totalQuotes: 0,
  fetchQuotes: vi.fn(),
});

vi.mock('~/stores/quotes', () => ({
  useQuotesStore: () => mockStore,
}));

// Stub definePageMeta — not available in test env
vi.stubGlobal('definePageMeta', vi.fn());

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
};

function makeQuote(overrides: Partial<QuoteListItem> = {}): QuoteListItem {
  return {
    id: 'q-001',
    quoteNumber: 'Q-2024-001',
    contactName: 'Jane Doe',
    contactEmail: 'jane@example.com',
    status: 'pending',
    total: 1500,
    totalFormatted: '1 500,00 kr',
    currency: 'SEK',
    itemCount: 3,
    createdAt: '2024-03-01T10:00:00Z',
    ...overrides,
  };
}

describe('PortalQuotations page', () => {
  beforeEach(() => {
    mockStore.quotes = [];
    mockStore.isLoading = false;
    mockStore.totalQuotes = 0;
    mockStore.fetchQuotes.mockClear();
  });

  describe('page structure', () => {
    it('renders inside PortalShell', () => {
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="portal-shell"]').exists()).toBe(true);
    });

    it('calls fetchQuotes on mount', () => {
      mountComponent(PortalQuotations, { global: { stubs: defaultStubs } });
      expect(mockStore.fetchQuotes).toHaveBeenCalledOnce();
    });
  });

  describe('loading state', () => {
    it('shows loading state when isLoading is true', () => {
      mockStore.isLoading = true;
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

  describe('empty state', () => {
    it('shows empty state when there are no quotes and not loading', () => {
      mockStore.quotes = [];
      mockStore.isLoading = false;
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="quotations-empty"]').exists()).toBe(
        true,
      );
      expect(wrapper.find('[data-testid="quotations-empty"]').text()).toContain(
        'portal.quotations.no_quotations',
      );
    });

    it('does not show table when there are no quotes', () => {
      mockStore.quotes = [];
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="quotations-table"]').exists()).toBe(
        false,
      );
    });
  });

  describe('table rendering', () => {
    it('renders the table when quotes are present', () => {
      mockStore.quotes = [makeQuote()];
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="quotations-table"]').exists()).toBe(
        true,
      );
    });

    it('renders a row for each quote', () => {
      mockStore.quotes = [
        makeQuote({ id: 'q-001', quoteNumber: 'Q-001' }),
        makeQuote({ id: 'q-002', quoteNumber: 'Q-002' }),
        makeQuote({ id: 'q-003', quoteNumber: 'Q-003' }),
      ];
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const rows = wrapper.findAll('[data-testid="quotation-row"]');
      expect(rows).toHaveLength(3);
    });

    it('displays quote number in each row', () => {
      mockStore.quotes = [makeQuote({ quoteNumber: 'Q-2024-042' })];
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="quotation-row"]').text()).toContain(
        'Q-2024-042',
      );
    });

    it('displays contact name in each row', () => {
      mockStore.quotes = [makeQuote({ contactName: 'John Smith' })];
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="quotation-row"]').text()).toContain(
        'John Smith',
      );
    });

    it('displays formatted total in each row', () => {
      mockStore.quotes = [makeQuote({ totalFormatted: '2 500,00 kr' })];
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="quotation-row"]').text()).toContain(
        '2 500,00 kr',
      );
    });

    it('renders a view link for each quote', () => {
      mockStore.quotes = [makeQuote({ id: 'q-abc' })];
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const link = wrapper.find('[data-testid="quotation-view-link"]');
      expect(link.exists()).toBe(true);
      expect(link.attributes('href')).toBe('/portal/quotations/q-abc');
    });
  });

  describe('status badges', () => {
    const statuses = [
      'pending',
      'accepted',
      'rejected',
      'expired',
      'cancelled',
    ] as const;

    for (const status of statuses) {
      it(`renders status badge for ${status}`, () => {
        mockStore.quotes = [makeQuote({ status })];
        const wrapper = mountComponent(PortalQuotations, {
          global: { stubs: defaultStubs },
        });
        const badge = wrapper.find('[data-testid="quote-status-badge"]');
        expect(badge.exists()).toBe(true);
        expect(badge.text()).toContain(`portal.quotations.status_${status}`);
      });
    }

    it('applies amber class to pending badge', () => {
      mockStore.quotes = [makeQuote({ status: 'pending' })];
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const badge = wrapper.find('[data-testid="quote-status-badge"]');
      expect(badge.classes().join(' ')).toContain('amber');
    });

    it('applies green class to accepted badge', () => {
      mockStore.quotes = [makeQuote({ status: 'accepted' })];
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const badge = wrapper.find('[data-testid="quote-status-badge"]');
      expect(badge.classes().join(' ')).toContain('green');
    });

    it('applies red class to rejected badge', () => {
      mockStore.quotes = [makeQuote({ status: 'rejected' })];
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const badge = wrapper.find('[data-testid="quote-status-badge"]');
      expect(badge.classes().join(' ')).toContain('red');
    });

    it('applies gray class to expired badge', () => {
      mockStore.quotes = [makeQuote({ status: 'expired' })];
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const badge = wrapper.find('[data-testid="quote-status-badge"]');
      expect(badge.classes().join(' ')).toContain('gray');
    });

    it('applies gray class to cancelled badge', () => {
      mockStore.quotes = [makeQuote({ status: 'cancelled' })];
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const badge = wrapper.find('[data-testid="quote-status-badge"]');
      expect(badge.classes().join(' ')).toContain('gray');
    });
  });

  describe('search filtering', () => {
    it('shows all quotes when search is empty', async () => {
      mockStore.quotes = [
        makeQuote({ id: 'q-001', quoteNumber: 'Q-001', contactName: 'Alice' }),
        makeQuote({ id: 'q-002', quoteNumber: 'Q-002', contactName: 'Bob' }),
      ];
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const rows = wrapper.findAll('[data-testid="quotation-row"]');
      expect(rows).toHaveLength(2);
    });

    it('filters quotes by quote number', async () => {
      mockStore.quotes = [
        makeQuote({ id: 'q-001', quoteNumber: 'Q-2024-001' }),
        makeQuote({ id: 'q-002', quoteNumber: 'Q-2024-002' }),
      ];
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const input = wrapper.find('[data-testid="quotations-search"]');
      await input.setValue('Q-2024-001');
      const rows = wrapper.findAll('[data-testid="quotation-row"]');
      expect(rows).toHaveLength(1);
    });

    it('filters quotes by contact name', async () => {
      mockStore.quotes = [
        makeQuote({ id: 'q-001', contactName: 'Alice Anderson' }),
        makeQuote({ id: 'q-002', contactName: 'Bob Baker' }),
      ];
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const input = wrapper.find('[data-testid="quotations-search"]');
      await input.setValue('Alice');
      const rows = wrapper.findAll('[data-testid="quotation-row"]');
      expect(rows).toHaveLength(1);
      expect(rows[0]!.text()).toContain('Alice Anderson');
    });

    it('search is case-insensitive', async () => {
      mockStore.quotes = [makeQuote({ contactName: 'Jane Doe' })];
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const input = wrapper.find('[data-testid="quotations-search"]');
      await input.setValue('jane');
      const rows = wrapper.findAll('[data-testid="quotation-row"]');
      expect(rows).toHaveLength(1);
    });

    it('shows empty state when search has no matches', async () => {
      mockStore.quotes = [makeQuote({ contactName: 'Alice' })];
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
});
