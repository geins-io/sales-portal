import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import ProductCard from '../../../app/components/shared/ProductCard.vue';

const geinsImageStub = {
  template: '<div class="geins-image" />',
  props: ['fileName', 'type', 'alt', 'loading'],
};

const stubs = {
  GeinsImage: geinsImageStub,
  SharedGeinsImage: geinsImageStub,
  PriceDisplay: {
    template: '<span class="price-display" />',
    props: ['price'],
  },
  SharedPriceDisplay: {
    template: '<span class="price-display" />',
    props: ['price'],
  },
  StockBadge: {
    template: '<span class="stock-badge" />',
    props: ['stock'],
  },
  SharedStockBadge: {
    template: '<span class="stock-badge" />',
    props: ['stock'],
  },
};

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    productId: 1,
    name: 'Test Product',
    alias: 'test-product',
    articleNumber: 'ART-001',
    categoryId: 1,
    weight: 500,
    supplierId: 1,
    canonicalUrl: '/products/test-product',
    brand: { brandId: 1, name: 'Test Brand' },
    unitPrice: {
      sellingPriceIncVat: 199,
      sellingPriceIncVatFormatted: '199,00 kr',
      isDiscounted: false,
    },
    totalStock: { inStock: 10, oversellable: 0, totalStock: 10, static: 0 },
    productImages: [{ fileName: 'product-1.jpg', isPrimary: true, url: '' }],
    ...overrides,
  };
}

describe('ProductCard', () => {
  it('renders product name', () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: makeProduct() },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('Test Product');
  });

  it('renders brand name', () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: makeProduct() },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('Test Brand');
  });

  it('renders GeinsImage with first product image', () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: makeProduct() },
      global: { stubs },
    });
    expect(wrapper.find('.geins-image').exists()).toBe(true);
  });

  it('renders PriceDisplay with unitPrice', () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: makeProduct() },
      global: { stubs },
    });
    expect(wrapper.find('.price-display').exists()).toBe(true);
  });

  it('renders StockBadge with totalStock', () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: makeProduct() },
      global: { stubs },
    });
    expect(wrapper.find('.stock-badge').exists()).toBe(true);
  });

  it('wraps in NuxtLink to canonicalUrl', () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: makeProduct() },
      global: { stubs },
    });
    const link = wrapper.find('a');
    expect(link.exists()).toBe(true);
    expect(link.attributes('href')).toBe('/products/test-product');
  });

  it('applies grid variant by default', () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: makeProduct() },
      global: { stubs },
    });
    expect(wrapper.find('.flex-col').exists()).toBe(true);
  });

  it('applies list variant when specified', () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: makeProduct(), variant: 'list' },
      global: { stubs },
    });
    expect(wrapper.find('.flex-row').exists()).toBe(true);
  });

  it('handles missing brand gracefully', () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: makeProduct({ brand: undefined }) },
      global: { stubs },
    });
    expect(wrapper.text()).not.toContain('Test Brand');
  });

  it('handles missing images gracefully', () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: makeProduct({ productImages: [] }) },
      global: { stubs },
    });
    expect(wrapper.find('.geins-image').exists()).toBe(false);
  });
});
