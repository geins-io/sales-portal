import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { mountComponent } from '../../utils/component';
import type { QuoteListItem } from '../../../shared/types/quote';

// Mock useFetch — returns reactive refs
const mockData = ref<{
  quotes: QuoteListItem[];
  total: number;
} | null>(null);
const mockPending = ref(false);
const mockError = ref<Error | null>(null);
const mockRefresh = vi.fn();

const useFetchMock = vi.fn(() => ({
  data: mockData,
  pending: mockPending,
  error: mockError,
  refresh: mockRefresh,
}));

vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: unknown[]) => useFetchMock(...args),
  $fetch: vi.fn(),
}));

vi.stubGlobal('useFetch', (...args: unknown[]) => useFetchMock(...args));
vi.stubGlobal('definePageMeta', vi.fn());

// Import AFTER mocks are set up
const { default: PortalQuotations } =
  await import('../../../app/pages/portal/quotations.vue');

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
    mockData.value = null;
    mockPending.value = false;
    mockError.value = null;
    mockRefresh.mockClear();
    useFetchMock.mockClear();
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
    it('shows empty state when there are no quotes and not loading', () => {
      mockData.value = { quotes: [], total: 0 };
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
      mockData.value = { quotes: [], total: 0 };
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
      const rows = wrapper.findAll('[data-testid="quotation-row"]');
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
      expect(wrapper.find('[data-testid="quotation-row"]').text()).toContain(
        'Q-2024-042',
      );
    });

    it('displays contact name in each row', () => {
      mockData.value = {
        quotes: [makeQuote({ contactName: 'John Smith' })],
        total: 1,
      };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="quotation-row"]').text()).toContain(
        'John Smith',
      );
    });

    it('displays formatted total in each row', () => {
      mockData.value = {
        quotes: [makeQuote({ totalFormatted: '2 500,00 kr' })],
        total: 1,
      };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      expect(wrapper.find('[data-testid="quotation-row"]').text()).toContain(
        '2 500,00 kr',
      );
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

    it('uses secondary variant for pending badge', () => {
      mockData.value = {
        quotes: [makeQuote({ status: 'pending' })],
        total: 1,
      };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const badge = wrapper.find('[data-testid="quote-status-badge"]');
      expect(badge.exists()).toBe(true);
    });

    it('uses default variant for accepted badge', () => {
      mockData.value = {
        quotes: [makeQuote({ status: 'accepted' })],
        total: 1,
      };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const badge = wrapper.find('[data-testid="quote-status-badge"]');
      expect(badge.exists()).toBe(true);
    });

    it('uses destructive variant for rejected badge', () => {
      mockData.value = {
        quotes: [makeQuote({ status: 'rejected' })],
        total: 1,
      };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const badge = wrapper.find('[data-testid="quote-status-badge"]');
      expect(badge.exists()).toBe(true);
    });

    it('uses secondary variant for expired badge', () => {
      mockData.value = {
        quotes: [makeQuote({ status: 'expired' })],
        total: 1,
      };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const badge = wrapper.find('[data-testid="quote-status-badge"]');
      expect(badge.exists()).toBe(true);
    });

    it('uses secondary variant for cancelled badge', () => {
      mockData.value = {
        quotes: [makeQuote({ status: 'cancelled' })],
        total: 1,
      };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const badge = wrapper.find('[data-testid="quote-status-badge"]');
      expect(badge.exists()).toBe(true);
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
      const rows = wrapper.findAll('[data-testid="quotation-row"]');
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
      const rows = wrapper.findAll('[data-testid="quotation-row"]');
      expect(rows).toHaveLength(1);
    });

    it('filters quotes by contact name', async () => {
      mockData.value = {
        quotes: [
          makeQuote({ id: 'q-001', contactName: 'Alice Anderson' }),
          makeQuote({ id: 'q-002', contactName: 'Bob Baker' }),
        ],
        total: 2,
      };
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
      mockData.value = {
        quotes: [makeQuote({ contactName: 'Jane Doe' })],
        total: 1,
      };
      const wrapper = mountComponent(PortalQuotations, {
        global: { stubs: defaultStubs },
      });
      const input = wrapper.find('[data-testid="quotations-search"]');
      await input.setValue('jane');
      const rows = wrapper.findAll('[data-testid="quotation-row"]');
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
});
