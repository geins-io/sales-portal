import { describe, it, expect, assert, afterEach, vi } from 'vitest';
import { ref } from 'vue';
import { mountComponent } from '../../utils/component';
import { mockShowIncVat, mockTenantTimezone } from '../../setup-components';
import PortalOrdersTable from '../../../app/components/portal/PortalOrdersTable.vue';
import { badgeVariants } from '../../../app/components/ui/badge';

const mockShowPrice = ref(true);
vi.mock('../../../app/composables/usePriceVisibility', () => ({
  usePriceVisibility: () => ({ showPrice: mockShowPrice }),
}));

const mockOrders = [
  {
    id: 2124,
    publicId: 'pub-2124',
    status: 'placed',
    createdAt: '2025-12-22T17:22:00Z',
    billingAddress: { firstName: 'Adam', lastName: 'Johnsson' },
    cart: {
      summary: {
        total: {
          sellingPriceIncVat: 17000,
          sellingPriceIncVatFormatted: '17 000 SEK',
          sellingPriceExVat: 13600,
          sellingPriceExVatFormatted: '13 600 SEK',
        },
      },
    },
  },
  {
    id: 2125,
    publicId: 'pub-2125',
    status: 'delivered',
    createdAt: '2025-12-23T10:00:00Z',
    billingAddress: { firstName: 'Jessica', lastName: 'Andersson' },
    cart: {
      summary: {
        total: {
          sellingPriceIncVat: 8500,
          sellingPriceIncVatFormatted: '8 500 SEK',
          sellingPriceExVat: 6800,
          sellingPriceExVatFormatted: '6 800 SEK',
        },
      },
    },
  },
];

const [firstOrder, secondOrder] = mockOrders;
assert.isDefined(firstOrder);
assert.isDefined(secondOrder);

// The ref is shared across the whole component tier and nothing resets it.
afterEach(() => {
  mockTenantTimezone.value = undefined;
  mockShowIncVat.value = true;
});

describe('PortalOrdersTable', () => {
  it('renders table headers', () => {
    const wrapper = mountComponent(PortalOrdersTable, {
      props: { orders: mockOrders },
    });
    expect(wrapper.text()).toContain('portal.orders.columns.id');
    expect(wrapper.text()).toContain('portal.orders.columns.status');
  });

  it('renders order rows', () => {
    const wrapper = mountComponent(PortalOrdersTable, {
      props: { orders: mockOrders },
    });
    expect(wrapper.text()).toContain('2124');
    expect(wrapper.text()).toContain('2125');
  });

  it('renders status badges', () => {
    const wrapper = mountComponent(PortalOrdersTable, {
      props: { orders: mockOrders },
    });
    expect(wrapper.text()).toContain('portal.orders.status.placed');
    expect(wrapper.text()).toContain('portal.orders.status.delivered');
  });

  it('renders placedBy when resolved from the company buyer roster', () => {
    const wrapper = mountComponent(PortalOrdersTable, {
      props: {
        orders: [{ ...firstOrder, placedBy: 'Anna Nilsson' }],
      },
    });
    expect(wrapper.text()).toContain('Anna Nilsson');
  });

  it('renders the per-order buyer on each row, not a single shared name', () => {
    const wrapper = mountComponent(PortalOrdersTable, {
      props: {
        orders: [
          { ...firstOrder, placedBy: 'Anna Nilsson' },
          { ...secondOrder, placedBy: 'Bea Karlsson' },
        ],
      },
    });
    const text = wrapper.text();
    expect(text).toContain('Anna Nilsson');
    expect(text).toContain('Bea Karlsson');
  });

  it('renders a dash when placedBy is unresolved, never the billing contact', () => {
    const wrapper = mountComponent(PortalOrdersTable, {
      props: { orders: mockOrders },
    });
    // billingAddress is the company billing contact and would mislead the
    // viewer into thinking that person placed the order.
    expect(wrapper.text()).not.toContain('Adam Johnsson');
    expect(wrapper.text()).not.toContain('Jessica Andersson');
  });

  it('formats createdAt as date only in the active locale, dropping the time portion', () => {
    const wrapper = mountComponent(PortalOrdersTable, {
      props: { orders: mockOrders },
    });
    // The setup-components useI18n mock pins the locale to 'en'.
    expect(wrapper.text()).toContain('12/22/2025');
    expect(wrapper.text()).not.toMatch(/12\/22\/2025,?\s+\d{2}:\d{2}/);
  });

  it('renders createdAt on the calendar day of the tenant timezone', () => {
    // 2025-12-22T17:22Z is already the 23rd in Auckland and still the 22nd in
    // UTC. Both zones are asserted, so the day cannot come from whatever zone
    // the test runner happens to be in — only from the tenant's own.
    mockTenantTimezone.value = 'Pacific/Auckland';
    expect(
      mountComponent(PortalOrdersTable, {
        props: { orders: mockOrders },
      }).text(),
    ).toContain('12/23/2025');

    mockTenantTimezone.value = 'UTC';
    expect(
      mountComponent(PortalOrdersTable, {
        props: { orders: mockOrders },
      }).text(),
    ).toContain('12/22/2025');
  });

  it('shows empty state when no orders', () => {
    const wrapper = mountComponent(PortalOrdersTable, {
      props: { orders: [] },
    });
    expect(wrapper.find('[data-testid="orders-empty"]').exists()).toBe(true);
  });

  it('does not render the table wrapper when there are no orders', () => {
    const wrapper = mountComponent(PortalOrdersTable, {
      props: { orders: [] },
    });
    expect(wrapper.find('[data-testid="portal-orders-table"]').exists()).toBe(
      false,
    );
  });

  it('renders the table wrapper when there are orders', () => {
    const wrapper = mountComponent(PortalOrdersTable, {
      props: { orders: mockOrders },
    });
    expect(wrapper.find('[data-testid="portal-orders-table"]').exists()).toBe(
      true,
    );
  });

  it('shows view link for each order', () => {
    const wrapper = mountComponent(PortalOrdersTable, {
      props: { orders: mockOrders },
    });
    const viewLinks = wrapper.findAll('[data-testid="order-view-link"]');
    expect(viewLinks.length).toBe(2);
  });

  it('view link uses publicId in href', () => {
    const wrapper = mountComponent(PortalOrdersTable, {
      props: { orders: mockOrders },
    });
    const viewLink = wrapper.find('[data-testid="order-view-link"]');
    expect(viewLink.attributes('href')).toContain('pub-2124');
  });

  it('view link falls back to id when publicId is missing', () => {
    const ordersWithoutPublicId = [{ ...firstOrder, publicId: undefined }];
    const wrapper = mountComponent(PortalOrdersTable, {
      props: { orders: ordersWithoutPublicId },
    });
    const viewLink = wrapper.find('[data-testid="order-view-link"]');
    expect(viewLink.attributes('href')).toContain('2124');
  });

  it('emits sort event when Created header is clicked', async () => {
    const wrapper = mountComponent(PortalOrdersTable, {
      props: { orders: mockOrders, sortDirection: 'desc' },
    });
    const createdHeader = wrapper.find('[data-testid="sort-created"]');
    expect(createdHeader.exists()).toBe(true);
    await createdHeader.trigger('click');
    expect(wrapper.emitted('sort')).toBeTruthy();
    expect(wrapper.emitted('sort')![0]).toEqual(['created']);
  });

  it.each([
    ['delivered', 'success-solid'],
    ['cancelled', 'destructive-soft'],
    ['processing', 'info'],
    ['on-hold', 'warning'],
    ['backorder', 'warning'],
    ['placed', 'neutral'],
  ] as const)(
    'renders %s as the %s badge in both layouts',
    (status, variant) => {
      const wrapper = mountComponent(PortalOrdersTable, {
        props: { orders: [{ ...mockOrders[0], status }] },
      });
      const badges = wrapper.findAll('[data-slot="badge"]');
      expect(badges).toHaveLength(2);
      for (const badge of badges) {
        expect(badge.classes()).toEqual(
          expect.arrayContaining(badgeVariants({ variant }).split(' ')),
        );
      }
    },
  );

  it('translates a Geins status outside the original six', () => {
    const wrapper = mountComponent(PortalOrdersTable, {
      props: { orders: [{ ...mockOrders[0], status: 'backorder' }] },
    });
    expect(wrapper.text()).toContain('portal.orders.status.backorder');
  });

  it('shows an unknown status as readable text, not a key path', () => {
    const wrapper = mountComponent(PortalOrdersTable, {
      props: { orders: [{ ...mockOrders[0], status: 'ready-for-pickup' }] },
    });
    expect(wrapper.text()).toContain('Ready for pickup');
    expect(wrapper.text()).not.toContain('portal.orders.status.');
  });

  describe('follows the VAT choice', () => {
    function totals() {
      const wrapper = mountComponent(PortalOrdersTable, {
        props: { orders: mockOrders },
      });
      return wrapper
        .findAll('[data-testid="order-total"]')
        .map((cell) => cell.text());
    }

    it('shows the order totals inc VAT when inc is chosen', () => {
      mockShowIncVat.value = true;
      const cells = totals();
      expect(cells).toContain('17 000 SEK');
      expect(cells).toContain('8 500 SEK');
    });

    it('shows the order totals ex VAT when ex is chosen', () => {
      mockShowIncVat.value = false;
      const cells = totals();
      expect(cells).toContain('13 600 SEK');
      expect(cells).toContain('6 800 SEK');
      expect(cells.join(' ')).not.toContain('17 000');
    });

    it('shows a dash rather than the inc total when the ex total is missing', () => {
      mockShowIncVat.value = false;
      const wrapper = mountComponent(PortalOrdersTable, {
        props: {
          orders: [
            {
              ...firstOrder,
              cart: {
                summary: {
                  total: {
                    sellingPriceIncVat: 17000,
                    sellingPriceIncVatFormatted: '17 000 SEK',
                  },
                },
              },
            },
          ],
        },
      });
      for (const cell of wrapper.findAll('[data-testid="order-total"]')) {
        expect(cell.text()).toBe('-');
      }
    });
  });

  describe('where prices are hidden', () => {
    afterEach(() => {
      mockShowPrice.value = true;
    });

    it('shows the sum column and each order total where prices are shown', () => {
      const wrapper = mountComponent(PortalOrdersTable, {
        props: { orders: mockOrders },
      });

      expect(wrapper.text()).toContain('portal.orders.columns.sum');
      // Mobile card and desktop row per order.
      expect(wrapper.findAll('[data-testid="order-total"]')).toHaveLength(4);
    });

    it('lists the orders with no sum column and no total', () => {
      mockShowPrice.value = false;
      const wrapper = mountComponent(PortalOrdersTable, {
        props: { orders: mockOrders },
      });

      expect(wrapper.findAll('[data-testid="order-row"]')).toHaveLength(4);
      expect(wrapper.text()).toContain('2124');
      expect(wrapper.text()).toContain('portal.orders.columns.status');
      expect(wrapper.text()).not.toContain('portal.orders.columns.sum');
      expect(wrapper.find('[data-testid="order-total"]').exists()).toBe(false);
      for (const amount of ['17 000', '13 600', '8 500', '6 800']) {
        expect(wrapper.text()).not.toContain(amount);
      }
    });
  });
});
