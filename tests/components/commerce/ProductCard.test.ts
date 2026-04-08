import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mountComponent } from '../../utils/component';
import ProductCard from '../../../app/components/shared/ProductCard.vue';
import { useTenant } from '../../../app/composables/useTenant';

// useTenant mock is provided by setup-components.ts — access tenant ref to control features
const { tenant } = useTenant();

const mockCanAccess = vi.fn(() => true);

vi.mock('../../../app/composables/useFeatureAccess', () => ({
  useFeatureAccess: () => ({ canAccess: mockCanAccess }),
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

const mockToggle = vi.fn();
const mockIsFavorite = vi.fn(() => false);

vi.mock('~/stores/favorites', () => ({
  useFavoritesStore: () => ({
    toggle: mockToggle,
    isFavorite: mockIsFavorite,
    items: [],
    count: 0,
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
      '<button v-bind="$attrs" :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
    props: ['disabled', 'variant', 'size'],
    emits: ['click'],
  },
  UiButton: {
    template:
      '<button v-bind="$attrs" :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
    props: ['disabled', 'variant', 'size'],
    emits: ['click'],
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
    mockToggle.mockReset();
    mockIsFavorite.mockReset().mockReturnValue(false);
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
    // Both should point to the product URL (localePath mock prepends /se/en/)
    links.forEach((link) => {
      expect(link.attributes('href')).toBe('/se/en/p/products/test-product');
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

  it('renders wishlist button when feature is enabled', () => {
    tenant.value.features = { wishlist: { enabled: true } };
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

  describe('campaign badges', () => {
    it('shows visible campaigns as badges', () => {
      const wrapper = mountComponent(ProductCard, {
        props: {
          product: makeProduct({
            discountCampaigns: [{ name: 'Summer Sale', hideTitle: false }],
          }),
        },
        global: { stubs },
      });
      const badges = wrapper.findAll('[data-testid="campaign-badge"]');
      expect(badges.length).toBe(1);
      expect(badges[0].text()).toBe('Summer Sale');
    });

    it('hides campaigns with hideTitle true', () => {
      const wrapper = mountComponent(ProductCard, {
        props: {
          product: makeProduct({
            discountCampaigns: [{ name: 'Secret', hideTitle: true }],
          }),
        },
        global: { stubs },
      });
      expect(wrapper.findAll('[data-testid="campaign-badge"]').length).toBe(0);
    });

    it('shows multiple campaigns stacked', () => {
      const wrapper = mountComponent(ProductCard, {
        props: {
          product: makeProduct({
            discountCampaigns: [
              { name: 'Sale A', hideTitle: false },
              { name: 'Sale B', hideTitle: false },
            ],
          }),
        },
        global: { stubs },
      });
      expect(wrapper.findAll('[data-testid="campaign-badge"]').length).toBe(2);
    });

    it('shows no badge container when no campaigns', () => {
      const wrapper = mountComponent(ProductCard, {
        props: {
          product: makeProduct({ discountCampaigns: [] }),
        },
        global: { stubs },
      });
      expect(wrapper.findAll('[data-testid="campaign-badge"]').length).toBe(0);
    });

    it('shows badges in list variant', () => {
      const wrapper = mountComponent(ProductCard, {
        props: {
          product: makeProduct({
            discountCampaigns: [{ name: 'List Sale', hideTitle: false }],
          }),
          variant: 'list',
        },
        global: { stubs },
      });
      const badges = wrapper.findAll('[data-testid="campaign-badge"]');
      expect(badges.length).toBe(1);
      expect(badges[0].text()).toBe('List Sale');
    });
  });

  describe('wishlist', () => {
    afterEach(() => {
      tenant.value.features = {};
    });

    it('hides wishlist button when feature is disabled', () => {
      tenant.value.features = {};
      const wrapper = mountComponent(ProductCard, {
        props: { product: makeProduct() },
        global: { stubs },
      });
      expect(wrapper.find('[data-testid="wishlist-button"]').exists()).toBe(
        false,
      );
    });

    it('shows wishlist button when feature is enabled', () => {
      tenant.value.features = { wishlist: { enabled: true } };
      const wrapper = mountComponent(ProductCard, {
        props: { product: makeProduct() },
        global: { stubs },
      });
      expect(wrapper.find('[data-testid="wishlist-button"]').exists()).toBe(
        true,
      );
    });

    it('calls toggle with product alias on click', async () => {
      tenant.value.features = { wishlist: { enabled: true } };
      const wrapper = mountComponent(ProductCard, {
        props: { product: makeProduct({ alias: 'my-product' }) },
        global: { stubs },
      });
      await wrapper.find('[data-testid="wishlist-button"]').trigger('click');
      expect(mockToggle).toHaveBeenCalledWith('my-product');
    });

    it('shows filled star when product is a favorite', () => {
      tenant.value.features = { wishlist: { enabled: true } };
      mockIsFavorite.mockReturnValue(true);
      const wrapper = mountComponent(ProductCard, {
        props: { product: makeProduct() },
        global: { stubs },
      });
      const button = wrapper.find('[data-testid="wishlist-button"]');
      expect(button.attributes('data-favorited')).toBe('true');
    });

    it('shows unfilled star when product is not a favorite', () => {
      tenant.value.features = { wishlist: { enabled: true } };
      mockIsFavorite.mockReturnValue(false);
      const wrapper = mountComponent(ProductCard, {
        props: { product: makeProduct() },
        global: { stubs },
      });
      const button = wrapper.find('[data-testid="wishlist-button"]');
      expect(button.attributes('data-favorited')).toBe('false');
    });
  });

  describe('feature flags', () => {
    afterEach(() => {
      tenant.value.features = {};
      mockCanAccess.mockReturnValue(true);
    });

    it('shows add-to-cart when pricing is not configured', () => {
      tenant.value.features = {};
      const wrapper = mountComponent(ProductCard, {
        props: { product: makeProduct() },
        global: { stubs },
      });
      expect(wrapper.find('[data-testid="add-to-cart-button"]').exists()).toBe(
        true,
      );
    });

    it('hides add-to-cart when pricing is restricted', () => {
      tenant.value.features = { pricing: { enabled: true } };
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
      tenant.value.features = { pricing: { enabled: true } };
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
