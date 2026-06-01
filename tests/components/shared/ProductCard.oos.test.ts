import { describe, it, expect, vi } from 'vitest';
import { ref, computed } from 'vue';
import { mountComponent } from '../../utils/component';
import ProductCard from '../../../app/components/shared/ProductCard.vue';

// useTenant and useLocaleMarket mocks are provided by setup-components.ts.
// This file exercises the out-of-stock UI swap (no add-to-cart, no qty;
// instead an OutOfStockBlock). The swap only fires when:
//   - useStockVisibility().showStock === true (tenant has stock visibility)
//   - product is the full Geins shape (isFullProduct => true)
//   - getStockStatus(totalStock) === 'out-of-stock'

vi.mock('~/stores/cart', () => ({
  useCartStore: () => ({
    addItem: vi.fn(),
    isLoading: false,
    error: null,
  }),
}));

vi.mock('~/stores/favorites', () => ({
  useFavoritesStore: () => ({
    isFavorite: vi.fn(() => false),
    toggle: vi.fn(),
  }),
}));

vi.mock('~/stores/auth', () => ({
  useAuthStore: () => ({ isAuthenticated: false }),
}));

vi.mock('../../../app/composables/useFeatureAccess', () => ({
  useFeatureAccess: () => ({ canAccess: vi.fn(() => true) }),
}));

// Default: stock visibility ON. Individual tests can override via vi.doMock
// pattern. Using a mutable ref through a module-level wrapper.
const showStockRef = ref(true);
vi.mock('../../../app/composables/useStockVisibility', () => ({
  useStockVisibility: () => ({ showStock: computed(() => showStockRef.value) }),
}));

const stubs = {
  GeinsImage: {
    props: ['fileName', 'type', 'alt'],
    template:
      '<img data-testid="geins-image" :data-file-name="fileName" :alt="alt" />',
  },
  QuantityInput: {
    props: ['modelValue', 'min', 'max', 'disabled'],
    template: '<div data-testid="quantity-input" />',
  },
  QuantityStepper: {
    props: ['modelValue', 'min', 'max', 'disabled'],
    template: '<div data-testid="quantity-stepper" />',
  },
  PriceDisplay: {
    template: '<span data-testid="price-display" />',
    props: ['price', 'lowestPrice', 'discountType', 'campaignNames'],
  },
  StockBadge: {
    template: '<span data-testid="stock-badge" />',
    props: ['stock', 'size'],
  },
  Button: {
    props: ['disabled', 'variant', 'size'],
    template:
      '<button data-testid="add-to-cart-button" :disabled="disabled"><slot /></button>',
  },
  AddToListDialog: true,
};

function makeFullProduct(overrides: Record<string, unknown> = {}) {
  return {
    productId: 1,
    name: 'Test Widget',
    alias: 'test-widget',
    articleNumber: 'ART-001',
    canonicalUrl: '/p/test-widget',
    productImages: [{ fileName: 'widget.jpg', isPrimary: true, url: '' }],
    skus: [{ skuId: 101, name: 'Default' }],
    unitPrice: {
      sellingPriceIncVat: 199,
      sellingPriceIncVatFormatted: '199,00 kr',
      isDiscounted: false,
    },
    totalStock: { totalStock: 5, inStock: 5, oversellable: 0, static: 0 },
    discountCampaigns: [],
    discountType: 'NONE',
    ...overrides,
  };
}

const briefProduct = {
  name: 'Brief Widget',
  imageFileName: 'widget.jpg',
  price: 199,
  articleNumber: 'ART-002',
  alias: 'brief-widget',
};

describe('ProductCard out-of-stock', () => {
  beforeEach(() => {
    showStockRef.value = true;
  });

  it('grid: OOS product hides add-to-cart and shows OOS block', () => {
    const product = makeFullProduct({
      totalStock: { totalStock: 0, inStock: 0, oversellable: 0, static: 0 },
    });
    const wrapper = mountComponent(ProductCard, {
      props: { product, variant: 'grid' },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="add-to-cart-button"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="oos-block"]').exists()).toBe(true);
  });

  it('grid: in-stock product shows add-to-cart and hides OOS block', () => {
    const product = makeFullProduct({
      totalStock: { totalStock: 5, inStock: 5, oversellable: 0, static: 0 },
    });
    const wrapper = mountComponent(ProductCard, {
      props: { product, variant: 'grid' },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="add-to-cart-button"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="oos-block"]').exists()).toBe(false);
  });

  it('list: OOS product hides add-to-cart and shows OOS block', () => {
    const product = makeFullProduct({
      totalStock: { totalStock: 0, inStock: 0, oversellable: 0, static: 0 },
    });
    const wrapper = mountComponent(ProductCard, {
      props: { product, variant: 'list' },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="add-to-cart-button"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="oos-block"]').exists()).toBe(true);
  });

  it('OOS UI fires regardless of the stockStatus tenant setting', () => {
    // showStock controls the in-stock/low-stock BADGE, not whether to gate
    // purchases. An OOS product must always swap the controls for the OOS
    // block — otherwise tenants who disable the stock badge silently let
    // customers add unavailable products to cart.
    showStockRef.value = false;
    const product = makeFullProduct({
      totalStock: { totalStock: 0, inStock: 0, oversellable: 0, static: 0 },
    });
    const wrapper = mountComponent(ProductCard, {
      props: { product, variant: 'grid' },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="add-to-cart-button"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="oos-block"]').exists()).toBe(true);
  });

  it('brief ProductCardItem shape: OOS detection short-circuits', () => {
    const wrapper = mountComponent(ProductCard, {
      props: { product: briefProduct, variant: 'grid' },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="add-to-cart-button"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="oos-block"]').exists()).toBe(false);
  });
});
