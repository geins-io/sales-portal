import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import PortalOrdersTable from '../../../app/components/portal/PortalOrdersTable.vue';

const mockOrders = [
  {
    id: 2124,
    status: 'placed',
    createdAt: '2025-12-22T17:22:00Z',
    billingAddress: { firstName: 'Adam', lastName: 'Johnsson' },
    cart: {
      summary: {
        total: {
          sellingPriceIncVat: 17000,
          sellingPriceIncVatFormatted: '17 000 SEK',
        },
      },
    },
  },
  {
    id: 2125,
    status: 'delivered',
    createdAt: '2025-12-23T10:00:00Z',
    billingAddress: { firstName: 'Jessica', lastName: 'Andersson' },
    cart: {
      summary: {
        total: {
          sellingPriceIncVat: 8500,
          sellingPriceIncVatFormatted: '8 500 SEK',
        },
      },
    },
  },
];

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

  it('renders placed by name from billingAddress', () => {
    const wrapper = mountComponent(PortalOrdersTable, {
      props: { orders: mockOrders },
    });
    expect(wrapper.text()).toContain('Adam Johnsson');
  });

  it('shows empty state when no orders', () => {
    const wrapper = mountComponent(PortalOrdersTable, {
      props: { orders: [] },
    });
    expect(wrapper.find('[data-testid="orders-empty"]').exists()).toBe(true);
  });

  it('shows view link for each order', () => {
    const wrapper = mountComponent(PortalOrdersTable, {
      props: { orders: mockOrders },
    });
    const viewLinks = wrapper.findAll('[data-testid="order-view-link"]');
    expect(viewLinks.length).toBe(2);
  });
});
