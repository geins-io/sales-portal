import { describe, it, expect, assert } from 'vitest';
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
    latestOrderId: '1421',
    latestOrderPublicId: 'order-abc-123',
    latestBuyerName: 'Adam Johnsson',
  },
  {
    name: 'Gadget Mini',
    articleNumber: 'ART-002',
    priceExVat: 85,
    priceExVatFormatted: '85,00 SEK',
    totalQuantity: 10,
    latestOrderDate: '2025-12-23T10:00:00Z',
    latestOrderId: '1422',
    latestOrderPublicId: 'order-def-456',
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
    const rows = wrapper.find('table').findAll('[data-testid="product-row"]');
    expect(rows.length).toBe(2);
  });

  it('shows empty state when no products', () => {
    const wrapper = mountComponent(PortalProductsTable, {
      props: { products: [], sortColumn: 'name', sortDirection: 'asc' },
    });
    expect(wrapper.find('table').exists()).toBe(false);
  });

  const SORT_HEADERS = [
    ['sort-product', 'name'],
    ['sort-total-ordered', 'totalQuantity'],
    ['sort-latest-order', 'latestOrderDate'],
  ] as const;

  it.each(SORT_HEADERS)(
    'emits sort with its column when %s is clicked',
    async (testId, column) => {
      const wrapper = mountComponent(PortalProductsTable, {
        props: {
          products: mockProducts,
          sortColumn: 'latestOrderDate',
          sortDirection: 'desc',
        },
      });
      await wrapper.find(`[data-testid="${testId}"] button`).trigger('click');
      expect(wrapper.emitted('sort')).toEqual([[column]]);
    },
  );

  it.each(SORT_HEADERS)(
    'puts the indicator and aria-sort only on %s when it is active',
    (activeTestId, column) => {
      for (const [direction, arrow, ariaSort] of [
        ['asc', '\u25B2', 'ascending'],
        ['desc', '\u25BC', 'descending'],
      ] as const) {
        const wrapper = mountComponent(PortalProductsTable, {
          props: {
            products: mockProducts,
            sortColumn: column,
            sortDirection: direction,
          },
        });
        for (const [testId] of SORT_HEADERS) {
          const header = wrapper.find(`[data-testid="${testId}"]`);
          if (testId === activeTestId) {
            expect(header.text()).toContain(arrow);
            expect(header.attributes('aria-sort')).toBe(ariaSort);
          } else {
            expect(header.text()).not.toMatch(/[\u25B2\u25BC]/);
            expect(header.attributes('aria-sort')).toBe('none');
          }
        }
      }
    },
  );

  it('renders order link with correct localePath', () => {
    const wrapper = mountComponent(PortalProductsTable, {
      props: {
        products: mockProducts,
        sortColumn: 'name',
        sortDirection: 'asc',
      },
    });
    const links = wrapper.find('table').findAll('[data-testid="order-link"]');
    expect(links.length).toBe(2);
    expect(links[0]?.attributes('href')).toContain('order-abc-123');
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
    const firstProduct = mockProducts[0];
    assert.isDefined(firstProduct);
    const productsNoFormatted = [
      { ...firstProduct, priceExVatFormatted: undefined },
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
