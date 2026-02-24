import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import SearchAutocomplete from '../../../app/components/search/SearchAutocomplete.vue';

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    productId: 1,
    name: 'Test Product',
    alias: 'test-product',
    canonicalUrl: '/p/test-product',
    articleNumber: 'ART-001',
    brand: { name: 'Test Brand' },
    primaryCategory: { name: 'Shoes' },
    unitPrice: {
      sellingPriceIncVat: 299,
      sellingPriceIncVatFormatted: '299 kr',
      regularPriceIncVat: 399,
      regularPriceIncVatFormatted: '399 kr',
      isDiscounted: true,
      discountPercentage: 25,
      currency: { code: 'SEK' },
    },
    productImages: [{ fileName: 'test.jpg', tags: [] }],
    totalStock: { totalStock: 10, inStock: 10, static: 0 },
    skus: [],
    discountCampaigns: [],
    ...overrides,
  };
}

const stubs = {
  GeinsImage: true,
  PriceDisplay: true,
  Icon: true,
  NuxtIcon: true,
};

describe('SearchAutocomplete', () => {
  it('renders product items when results provided', () => {
    const results = {
      products: [
        makeProduct({ productId: 1, name: 'Product A', alias: 'product-a' }),
        makeProduct({ productId: 2, name: 'Product B', alias: 'product-b' }),
      ],
      count: 2,
    };

    const wrapper = mountComponent(SearchAutocomplete, {
      props: { results, loading: false, open: true },
      global: { stubs },
    });

    const items = wrapper.findAll('[role="option"]');
    expect(items).toHaveLength(2);
    expect(wrapper.text()).toContain('Product A');
    expect(wrapper.text()).toContain('Product B');
  });

  it('limits to 5 product items', () => {
    const products = Array.from({ length: 8 }, (_, i) =>
      makeProduct({
        productId: i,
        name: `Product ${i}`,
        alias: `product-${i}`,
      }),
    );
    const results = { products, count: 8 };

    const wrapper = mountComponent(SearchAutocomplete, {
      props: { results, loading: false, open: true },
      global: { stubs },
    });

    const items = wrapper.findAll('[role="option"]');
    expect(items).toHaveLength(5);
  });

  it('shows "View all" link with count', () => {
    const results = {
      products: [makeProduct()],
      count: 42,
    };

    const wrapper = mountComponent(SearchAutocomplete, {
      props: { results, loading: false, open: true },
      global: { stubs },
    });

    // $t mock returns the key; verify the view-all button renders
    expect(wrapper.text()).toContain('search.view_all_results');
  });

  it('emits select-product on item click', async () => {
    const results = {
      products: [makeProduct({ alias: 'clicked-product' })],
      count: 1,
    };

    const wrapper = mountComponent(SearchAutocomplete, {
      props: { results, loading: false, open: true },
      global: { stubs },
    });

    await wrapper.find('[role="option"]').trigger('click');
    expect(wrapper.emitted('select-product')?.[0]?.[0]).toBe('clicked-product');
  });

  it('emits view-all on "View all" click', async () => {
    const results = {
      products: [makeProduct()],
      count: 10,
    };

    const wrapper = mountComponent(SearchAutocomplete, {
      props: { results, loading: false, open: true },
      global: { stubs },
    });

    const viewAllBtn = wrapper.find('button');
    await viewAllBtn.trigger('click');
    expect(wrapper.emitted('view-all')).toBeTruthy();
  });

  it('shows nothing when open is false', () => {
    const results = {
      products: [makeProduct()],
      count: 1,
    };

    const wrapper = mountComponent(SearchAutocomplete, {
      props: { results, loading: false, open: false },
      global: { stubs },
    });

    expect(wrapper.find('[data-slot="search-autocomplete"]').exists()).toBe(
      false,
    );
  });

  it('shows loading state', () => {
    const wrapper = mountComponent(SearchAutocomplete, {
      props: { results: null, loading: true, open: true },
      global: { stubs },
    });

    expect(wrapper.text()).toContain('common.loading');
  });

  it('shows no results message when products array is empty', () => {
    const results = { products: [], count: 0 };

    const wrapper = mountComponent(SearchAutocomplete, {
      props: { results, loading: false, open: true },
      global: { stubs },
    });

    expect(wrapper.text()).toContain('search.no_results');
  });
});
