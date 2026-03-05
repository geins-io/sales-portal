import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, computed } from 'vue';
import { mountComponent } from '../../utils/component';
import ProductCard from '../../../app/components/shared/ProductCard.vue';

const mockCanAccess = vi.fn(() => true);
const mockHasFeature = vi.fn((_name: string) => false);

vi.mock('../../../app/composables/useFeatureAccess', () => ({
  useFeatureAccess: () => ({ canAccess: mockCanAccess }),
}));

const tenant = ref({
  tenantId: 'test-tenant',
  hostname: 'test.example.com',
  locale: 'sv-SE',
  theme: {
    colors: {
      primary: 'oklch(0.205 0 0)',
      secondary: 'oklch(0.97 0 0)',
      background: 'oklch(1 0 0)',
      foreground: 'oklch(0.145 0 0)',
    },
    radius: '0.625rem',
  },
  branding: {
    name: 'Test Store',
    logoUrl: '/logo.svg',
    faviconUrl: '/favicon.ico',
  },
  features: {},
});

vi.mock('../../../app/composables/useTenant', () => ({
  useTenant: () => ({
    tenant,
    tenantId: computed(() => tenant.value?.tenantId ?? ''),
    hostname: computed(() => tenant.value?.hostname ?? ''),
    isLoading: ref(false),
    error: ref(null),
    refresh: vi.fn(),
    theme: computed(() => tenant.value?.theme),
    branding: computed(() => tenant.value?.branding),
    logoUrl: computed(() => '/logo.svg'),
    logoDarkUrl: computed(() => null),
    logoSymbolUrl: computed(() => null),
    faviconUrl: computed(() => '/favicon.ico'),
    ogImageUrl: computed(() => null),
    brandName: computed(() => 'Test Store'),
    mode: computed(() => 'commerce'),
    watermark: computed(() => 'full'),
    availableLocales: computed(() => ['sv']),
    availableMarkets: computed(() => []),
    market: computed(() => ''),
    imageBaseUrl: computed(() => 'https://monitor.commerce.services'),
    features: computed(() => tenant.value?.features),
    hasFeature: mockHasFeature,
    suspense: () => Promise.resolve(),
  }),
  useTenantTheme: () => ({
    colors: computed(() => tenant.value?.theme?.colors),
    typography: computed(() => undefined),
    radius: computed(() => tenant.value?.theme?.radius),
    getColor: () => '',
    primaryColor: computed(() => 'oklch(0.205 0 0)'),
    secondaryColor: computed(() => 'oklch(0.97 0 0)'),
    backgroundColor: computed(() => 'oklch(1 0 0)'),
    foregroundColor: computed(() => 'oklch(0.145 0 0)'),
  }),
}));

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

  describe('feature flags', () => {
    afterEach(() => {
      mockHasFeature.mockReturnValue(false);
      mockCanAccess.mockReturnValue(true);
    });

    it('shows add-to-cart when pricing is not configured', () => {
      mockHasFeature.mockReturnValue(false);
      const wrapper = mountComponent(ProductCard, {
        props: { product: makeProduct() },
        global: { stubs },
      });
      expect(wrapper.find('[data-testid="add-to-cart-button"]').exists()).toBe(
        true,
      );
    });

    it('hides add-to-cart when pricing is restricted', () => {
      mockHasFeature.mockReturnValue(true);
      mockCanAccess.mockReturnValue(false);
      const wrapper = mountComponent(ProductCard, {
        props: { product: makeProduct() },
        global: { stubs },
      });
      expect(wrapper.find('[data-testid="add-to-cart-button"]').exists()).toBe(
        false,
      );
    });

    it('shows add-to-cart when pricing is accessible', () => {
      mockHasFeature.mockReturnValue(true);
      mockCanAccess.mockReturnValue(true);
      const wrapper = mountComponent(ProductCard, {
        props: { product: makeProduct() },
        global: { stubs },
      });
      expect(wrapper.find('[data-testid="add-to-cart-button"]').exists()).toBe(
        true,
      );
    });
  });
});
