import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountComponent } from '../../utils/component';
import ProductCard from '../../../app/components/shared/ProductCard.vue';

const geinsImageStub = {
  template: '<div class="geins-image" />',
  props: ['fileName', 'type', 'alt', 'loading'],
};

const mockAddItem = vi.fn();

vi.mock('~/stores/cart', () => ({
  useCartStore: () => ({
    addItem: mockAddItem,
    isLoading: false,
  }),
}));

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
    props: ['stock', 'size'],
  },
  SharedStockBadge: {
    template: '<span class="stock-badge" />',
    props: ['stock', 'size'],
  },
  QuantityInput: {
    template: '<div class="quantity-input" />',
    props: ['modelValue', 'min'],
  },
  SharedQuantityInput: {
    template: '<div class="quantity-input" />',
    props: ['modelValue', 'min'],
  },
  Button: {
    template:
      '<button :data-testid="$attrs[\'data-testid\']" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
    props: ['disabled'],
    emits: ['click'],
    inheritAttrs: false,
  },
  UiButton: {
    template:
      '<button :data-testid="$attrs[\'data-testid\']" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
    props: ['disabled'],
    emits: ['click'],
    inheritAttrs: false,
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
    skus: [{ skuId: 101, name: 'Default', stock: { totalStock: 10 } }],
    ...overrides,
  };
}

describe('ProductCard', () => {
  beforeEach(() => {
    mockAddItem.mockReset();
  });

  it('renders product name', () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: makeProduct() },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('Test Product');
  });

  it('renders article number', () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: makeProduct() },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="article-number"]').exists()).toBe(true);
    // $t mock returns the key, so check the key is rendered
    expect(wrapper.find('[data-testid="article-number"]').text()).toContain(
      'product.article_number',
    );
  });

  it('renders stock badge below the title', () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: makeProduct() },
      global: { stubs },
    });
    expect(wrapper.find('.stock-badge').exists()).toBe(true);
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

  it('does not render stock badge when totalStock is missing', () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: makeProduct({ totalStock: undefined }) },
      global: { stubs },
    });
    expect(wrapper.find('.stock-badge').exists()).toBe(false);
  });

  it('only wraps image and title in NuxtLink, not the entire card', () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: makeProduct() },
      global: { stubs },
    });
    // The root element should be a div, not a link
    expect(wrapper.element.tagName).toBe('DIV');
    // There should be links for image and title
    const links = wrapper.findAll('a');
    expect(links.length).toBe(2);
    // Both should point to the product URL
    links.forEach((link) => {
      expect(link.attributes('href')).toBe('/products/test-product');
    });
  });

  it('renders QuantityInput', () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: makeProduct() },
      global: { stubs },
    });
    expect(wrapper.find('.quantity-input').exists()).toBe(true);
  });

  it('renders add-to-cart button', () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: makeProduct() },
      global: { stubs },
    });
    const button = wrapper.find('[data-testid="add-to-cart-button"]');
    expect(button.exists()).toBe(true);
    expect(button.text()).toContain('cart.add_to_cart');
  });

  it('calls addItem on cart store when add-to-cart is clicked', async () => {
    mockAddItem.mockResolvedValue(undefined);
    const wrapper = mountComponent(ProductCard, {
      props: { product: makeProduct() },
      global: { stubs },
    });
    const addToCartButton = wrapper.find('[data-testid="add-to-cart-button"]');
    expect(addToCartButton.exists()).toBe(true);
    await addToCartButton.trigger('click');
    expect(mockAddItem).toHaveBeenCalledWith(101, 1);
  });

  it('disables add-to-cart button when no skus available', () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: makeProduct({ skus: [] }) },
      global: { stubs },
    });
    const addToCartButton = wrapper.find('[data-testid="add-to-cart-button"]');
    expect(addToCartButton.attributes('disabled')).toBeDefined();
  });

  it('renders wishlist button', () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: makeProduct() },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="wishlist-button"]').exists()).toBe(true);
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

  it('handles missing totalStock gracefully', () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: makeProduct({ totalStock: undefined }) },
      global: { stubs },
    });
    expect(wrapper.find('.stock-badge').exists()).toBe(false);
  });

  it('handles missing article number gracefully', () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: makeProduct({ articleNumber: undefined }) },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="article-number"]').exists()).toBe(false);
  });

  it('handles missing images gracefully', () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: makeProduct({ productImages: [] }) },
      global: { stubs },
    });
    expect(wrapper.find('.geins-image').exists()).toBe(false);
  });
});
