import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import PortalProductsTable from '../../../app/components/portal/PortalProductsTable.vue';

const mockProducts = [
  {
    name: 'Widget Pro',
    articleNumber: 'ART-001',
    priceExVat: 150,
    priceExVatFormatted: '150,00 SEK',
    totalQuantity: 42,
    latestOrderDate: '2025-12-22T17:22:00Z',
    latestOrderId: 'order-abc-123',
    latestBuyerName: 'Adam Johnsson',
  },
  {
    name: 'Gadget Mini',
    articleNumber: 'ART-002',
    priceExVat: 85,
    priceExVatFormatted: '85,00 SEK',
    totalQuantity: 10,
    latestOrderDate: '2025-12-23T10:00:00Z',
    latestOrderId: 'order-def-456',
    latestBuyerName: 'Jessica Andersson',
  },
];

describe('PortalProductsTable', () => {
  it('renders table with product rows', () => {
    const wrapper = mountComponent(PortalProductsTable, {
      props: {
        products: mockProducts,
        sortColumn: 'name',
        sortDirection: 'asc',
      },
    });
    expect(wrapper.find('[data-testid="portal-products-table"]').exists()).toBe(
      true,
    );
    const rows = wrapper.findAll('[data-testid="product-row"]');
    expect(rows.length).toBe(2);
  });

  it('shows empty state when no products', () => {
    const wrapper = mountComponent(PortalProductsTable, {
      props: { products: [], sortColumn: 'name', sortDirection: 'asc' },
    });
    expect(wrapper.find('table').exists()).toBe(false);
  });

  it('emits sort event on product column click', async () => {
    const wrapper = mountComponent(PortalProductsTable, {
      props: {
        products: mockProducts,
        sortColumn: 'name',
        sortDirection: 'asc',
      },
    });
    const sortHeader = wrapper.find('[data-testid="sort-product"]');
    expect(sortHeader.exists()).toBe(true);
    await sortHeader.trigger('click');
    expect(wrapper.emitted('sort')).toBeTruthy();
    expect(wrapper.emitted('sort')![0]).toEqual(['name']);
  });

  it('shows ascending sort indicator when sortDirection is asc', () => {
    const wrapper = mountComponent(PortalProductsTable, {
      props: {
        products: mockProducts,
        sortColumn: 'name',
        sortDirection: 'asc',
      },
    });
    const sortHeader = wrapper.find('[data-testid="sort-product"]');
    expect(sortHeader.text()).toContain('\u25B2');
  });

  it('shows descending sort indicator when sortDirection is desc', () => {
    const wrapper = mountComponent(PortalProductsTable, {
      props: {
        products: mockProducts,
        sortColumn: 'name',
        sortDirection: 'desc',
      },
    });
    const sortHeader = wrapper.find('[data-testid="sort-product"]');
    expect(sortHeader.text()).toContain('\u25BC');
  });

  it('renders order link with correct localePath', () => {
    const wrapper = mountComponent(PortalProductsTable, {
      props: {
        products: mockProducts,
        sortColumn: 'name',
        sortDirection: 'asc',
      },
    });
    const links = wrapper.findAll('[data-testid="order-link"]');
    expect(links.length).toBe(2);
    expect(links[0].attributes('href')).toContain('order-abc-123');
  });

  it('displays all columns', () => {
    const wrapper = mountComponent(PortalProductsTable, {
      props: {
        products: mockProducts,
        sortColumn: 'name',
        sortDirection: 'asc',
      },
    });
    const text = wrapper.text();
    expect(text).toContain('Widget Pro');
    expect(text).toContain('ART-001');
    expect(text).toContain('150,00 SEK');
    expect(text).toContain('42');
    expect(text).toContain('Adam Johnsson');
  });

  it('falls back to raw price when priceExVatFormatted is missing', () => {
    const productsNoFormatted = [
      { ...mockProducts[0], priceExVatFormatted: undefined },
    ];
    const wrapper = mountComponent(PortalProductsTable, {
      props: {
        products: productsNoFormatted,
        sortColumn: 'name',
        sortDirection: 'asc',
      },
    });
    expect(wrapper.text()).toContain('150');
  });
});
