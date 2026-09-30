import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  assert,
} from 'vitest';
import type { PublicTenantConfig } from '#shared/types/tenant-config';
import { mountComponent } from '../../utils/component';
import ProductCard from '../../../app/components/shared/ProductCard.vue';
import { useTenant } from '../../../app/composables/useTenant';
import { mockIsCatalogMode } from '../../setup-components';

// Default to authenticated so wishlist/add-to-list buttons render. Individual
// tests can override by mutating `mockIsAuthenticated.value`.
import { ref } from 'vue';

// useTenant is mocked globally in setup-components.ts.
// Access the tenant ref to mutate features in individual tests.
const { tenant } = useTenant();

// `useTenant()` types `tenant` as nullable because the real composable fills it
// from useFetch. The setup-components mock always provides one, so assert it
// here once instead of reaching for `!` at each site.
function setFeatures(features: PublicTenantConfig['features']) {
  assert.isDefined(tenant.value);
  tenant.value.features = features;
}

const mockCanAccess = vi.fn<(featureName: string) => boolean>(() => true);

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
const mockIsAuthenticated = ref(true);

vi.mock('~/stores/auth', () => ({
  useAuthStore: () => ({
    get isAuthenticated() {
      return mockIsAuthenticated.value;
    },
  }),
}));

vi.mock('~/stores/favorites', () => ({
  useFavoritesStore: () => ({
    toggle: mockToggle,
    isFavorite: mockIsFavorite,
    items: [],
    count: 0,
    lists: [],
    favorites: null,
    productListIds: () => [],
    addItemToList: vi.fn(),
    removeItemFromList: vi.fn(),
    createList: vi.fn(),
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
    setFeatures({ wishlist: { enabled: true } });
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
    expect(wrapper.find('[data-testid="product-card"]').classes()).toContain(
      'md:flex-row',
    );
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
      expect(badges[0]?.text()).toBe('Summer Sale');
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
      expect(badges[0]?.text()).toBe('List Sale');
    });
  });

  describe('wishlist', () => {
    afterEach(() => {
      setFeatures({});
    });

    it('hides wishlist button when feature is disabled', () => {
      setFeatures({});
      const wrapper = mountComponent(ProductCard, {
        props: { product: makeProduct() },
        global: { stubs },
      });
      expect(wrapper.find('[data-testid="wishlist-button"]').exists()).toBe(
        false,
      );
    });

    it('hides wishlist button for unauthenticated users even when feature is enabled', () => {
      setFeatures({ wishlist: { enabled: true } });
      mockIsAuthenticated.value = false;
      const wrapper = mountComponent(ProductCard, {
        props: { product: makeProduct() },
        global: { stubs },
      });
      expect(wrapper.find('[data-testid="wishlist-button"]').exists()).toBe(
        false,
      );
      mockIsAuthenticated.value = true;
    });

    it('shows wishlist button when feature is enabled', () => {
      setFeatures({ wishlist: { enabled: true } });
      const wrapper = mountComponent(ProductCard, {
        props: { product: makeProduct() },
        global: { stubs },
      });
      expect(wrapper.find('[data-testid="wishlist-button"]').exists()).toBe(
        true,
      );
    });

    it('does not toggle favorites on click (opens picker dialog instead)', async () => {
      setFeatures({ wishlist: { enabled: true } });
      const wrapper = mountComponent(ProductCard, {
        props: { product: makeProduct({ alias: 'my-product' }) },
        global: { stubs },
      });
      await wrapper.find('[data-testid="wishlist-button"]').trigger('click');
      // Star button now opens the AddToListDialog rather than calling the
      // single-list `toggle` action. The dialog has its own test file.
      expect(mockToggle).not.toHaveBeenCalled();
    });

    it('shows filled star when product is a favorite', () => {
      setFeatures({ wishlist: { enabled: true } });
      mockIsFavorite.mockReturnValue(true);
      const wrapper = mountComponent(ProductCard, {
        props: { product: makeProduct() },
        global: { stubs },
      });
      const button = wrapper.find('[data-testid="wishlist-button"]');
      expect(button.attributes('data-favorited')).toBe('true');
    });

    it('shows unfilled star when product is not a favorite', () => {
      setFeatures({ wishlist: { enabled: true } });
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
      setFeatures({});
      mockCanAccess.mockReturnValue(true);
    });

    it('shows add-to-cart when pricing is not configured', () => {
      setFeatures({});
      const wrapper = mountComponent(ProductCard, {
        props: { product: makeProduct() },
        global: { stubs },
      });
      expect(wrapper.find('[data-testid="add-to-cart-button"]').exists()).toBe(
        true,
      );
    });

    it('hides add-to-cart when pricing is restricted', () => {
      setFeatures({ priceVisibility: { enabled: true } });
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
      setFeatures({ priceVisibility: { enabled: true } });
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

  // A configurable product cannot be bought without a configuration, and a
  // plain add of one is accepted upstream as a bare line at catalogue price.
  describe('configurable product', () => {
    afterEach(() => {
      mockCanAccess.mockReset().mockReturnValue(true);
    });

    const configurable = () => makeProduct({ configurable: true });

    it.each(['grid', 'list'] as const)(
      'offers "Konfigurera produkt" linking to the product page in the %s variant',
      (variant) => {
        const wrapper = mountComponent(ProductCard, {
          props: { product: configurable(), variant },
          global: { stubs },
        });
        const link = wrapper.find('[data-testid="configure-product-link"]');
        expect(link.exists()).toBe(true);
        expect(link.element.tagName).toBe('A');
        expect(link.attributes('href')).toBe('/se/en/p/products/test-product');
        expect(link.text()).toContain('configurator.configure_product');
      },
    );

    it.each(['grid', 'list'] as const)(
      'renders no quantity input and no add-to-cart in the %s variant',
      (variant) => {
        const wrapper = mountComponent(ProductCard, {
          props: { product: configurable(), variant },
          global: { stubs },
        });
        expect(wrapper.find('.quantity-input').exists()).toBe(false);
        expect(
          wrapper.find('[data-testid="add-to-cart-button"]').exists(),
        ).toBe(false);
      },
    );

    it('is an ordinary card for a buyer the configurator access rule refuses', () => {
      mockCanAccess.mockImplementation((feature) => feature !== 'configurator');
      const wrapper = mountComponent(ProductCard, {
        props: { product: configurable() },
        global: { stubs },
      });
      expect(mockCanAccess).toHaveBeenCalledWith('configurator');
      expect(
        wrapper.find('[data-testid="configure-product-link"]').exists(),
      ).toBe(false);
      expect(wrapper.find('[data-testid="add-to-cart-button"]').exists()).toBe(
        true,
      );
    });

    it('offers nothing to buy where purchase is not allowed', () => {
      mockIsCatalogMode.value = true;
      try {
        const wrapper = mountComponent(ProductCard, {
          props: { product: configurable() },
          global: { stubs },
        });
        expect(
          wrapper.find('[data-testid="configure-product-link"]').exists(),
        ).toBe(false);
        expect(
          wrapper.find('[data-testid="add-to-cart-button"]').exists(),
        ).toBe(false);
        // The product itself stays reachable: image and title still link to
        // its page, which is where the configurator is.
        expect(wrapper.text()).toContain('Test Product');
        const links = wrapper.findAll('a');
        expect(links.length).toBe(2);
        links.forEach((link) => {
          expect(link.attributes('href')).toBe(
            '/se/en/p/products/test-product',
          );
        });
      } finally {
        mockIsCatalogMode.value = false;
      }
    });

    it.each(['grid', 'list'] as const)(
      'leaves an ordinary product unchanged in the %s variant',
      (variant) => {
        const wrapper = mountComponent(ProductCard, {
          props: { product: makeProduct(), variant },
          global: { stubs },
        });
        expect(
          wrapper.find('[data-testid="configure-product-link"]').exists(),
        ).toBe(false);
        expect(
          wrapper.find('[data-testid="add-to-cart-button"]').exists(),
        ).toBe(true);
        expect(wrapper.find('.quantity-input').exists()).toBe(true);
      },
    );

    it('reads the flag as true only, as the page does', () => {
      const wrapper = mountComponent(ProductCard, {
        props: { product: makeProduct({ configurable: 'true' }) },
        global: { stubs },
      });
      expect(
        wrapper.find('[data-testid="configure-product-link"]').exists(),
      ).toBe(false);
    });

    it('offers the link on the brief card shape too', () => {
      const wrapper = mountComponent(ProductCard, {
        props: {
          product: {
            name: 'Arbetsbord',
            alias: 'arbetsbord-pro',
            price: '3 200 kr',
            configurable: true,
          },
        },
        global: { stubs },
      });
      const link = wrapper.find('[data-testid="configure-product-link"]');
      expect(link.attributes('href')).toBe('/se/en/p/arbetsbord-pro');
      expect(wrapper.find('[data-testid="add-to-cart-button"]').exists()).toBe(
        false,
      );
    });

    // The catalogue price has no relation to what a configuration costs, so
    // the card says where the price comes from instead of showing one.
    describe('price', () => {
      afterEach(() => {
        setFeatures({});
      });

      function hidePrices() {
        setFeatures({ priceVisibility: { enabled: true } });
        mockCanAccess.mockImplementation(
          (feature) => feature !== 'priceVisibility',
        );
      }

      const brief = (configurable: boolean) => ({
        name: 'Arbetsbord',
        alias: 'arbetsbord-pro',
        price: '3 200 kr',
        configurable,
      });

      it.each(['grid', 'list'] as const)(
        'shows the configuration text and no price in the %s variant',
        (variant) => {
          const wrapper = mountComponent(ProductCard, {
            props: { product: configurable(), variant },
            global: { stubs },
          });
          const note = wrapper.find(
            '[data-testid="card-price-on-configuration"]',
          );
          expect(note.exists()).toBe(true);
          expect(note.text()).toBe('configurator.price_on_configuration');
          expect(wrapper.find('.price-display').exists()).toBe(false);
          expect(wrapper.text()).not.toContain('common.vat_excl');
        },
      );

      it.each(['grid', 'list'] as const)(
        'shows neither text nor price when prices are hidden in the %s variant',
        (variant) => {
          hidePrices();
          const wrapper = mountComponent(ProductCard, {
            props: { product: configurable(), variant },
            global: { stubs },
          });
          expect(
            wrapper
              .find('[data-testid="card-price-on-configuration"]')
              .exists(),
          ).toBe(false);
          expect(wrapper.find('.price-display').exists()).toBe(false);
        },
      );

      // Below md the row is `justify-between`: without a left child the
      // configure button would move to the left edge.
      it('keeps the left slot of the list row when prices are hidden', () => {
        hidePrices();
        const wrapper = mountComponent(ProductCard, {
          props: { product: configurable(), variant: 'list' },
          global: { stubs },
        });
        const row = wrapper.find('.justify-between');
        const buttons = wrapper
          .find('[data-testid="configure-product-link"]')
          .element.closest('.shrink-0.items-center');
        expect(row.element.children).toHaveLength(2);
        expect(row.element.lastElementChild).toBe(buttons);
      });

      it.each(['grid', 'list'] as const)(
        'keeps the price on an ordinary product in the %s variant',
        (variant) => {
          const wrapper = mountComponent(ProductCard, {
            props: { product: makeProduct(), variant },
            global: { stubs },
          });
          expect(wrapper.find('.price-display').exists()).toBe(true);
          expect(
            wrapper
              .find('[data-testid="card-price-on-configuration"]')
              .exists(),
          ).toBe(false);
        },
      );

      it('keeps the price for a buyer the configurator access rule refuses', () => {
        mockCanAccess.mockImplementation(
          (feature) => feature !== 'configurator',
        );
        const wrapper = mountComponent(ProductCard, {
          props: { product: configurable() },
          global: { stubs },
        });
        expect(wrapper.find('.price-display').exists()).toBe(true);
        expect(
          wrapper.find('[data-testid="card-price-on-configuration"]').exists(),
        ).toBe(false);
      });

      it('shows the configuration text and no price on the brief card shape', () => {
        const wrapper = mountComponent(ProductCard, {
          props: { product: brief(true) },
          global: { stubs },
        });
        expect(
          wrapper.find('[data-testid="card-price-on-configuration"]').text(),
        ).toBe('configurator.price_on_configuration');
        expect(wrapper.find('[data-testid="price"]').exists()).toBe(false);
        expect(wrapper.text()).not.toContain('3 200 kr');
      });

      it('shows neither text nor price on the brief card shape when prices are hidden', () => {
        hidePrices();
        const wrapper = mountComponent(ProductCard, {
          props: { product: brief(true) },
          global: { stubs },
        });
        expect(
          wrapper.find('[data-testid="card-price-on-configuration"]').exists(),
        ).toBe(false);
        expect(wrapper.text()).not.toContain('3 200 kr');
      });

      it('keeps the price on an ordinary brief card', () => {
        const wrapper = mountComponent(ProductCard, {
          props: { product: brief(false) },
          global: { stubs },
        });
        expect(wrapper.find('[data-testid="price"]').text()).toBe('3 200 kr');
        expect(
          wrapper.find('[data-testid="card-price-on-configuration"]').exists(),
        ).toBe(false);
      });
    });
  });

  describe('catalog mode', () => {
    afterEach(() => {
      mockIsCatalogMode.value = false;
    });

    it('hides add-to-cart button in grid variant when catalog mode is active', () => {
      mockIsCatalogMode.value = true;
      const wrapper = mountComponent(ProductCard, {
        props: { product: makeProduct() },
        global: { stubs },
      });
      expect(wrapper.find('[data-testid="add-to-cart-button"]').exists()).toBe(
        false,
      );
    });

    it('hides add-to-cart button in list variant when catalog mode is active', () => {
      mockIsCatalogMode.value = true;
      const wrapper = mountComponent(ProductCard, {
        props: { product: makeProduct(), variant: 'list' },
        global: { stubs },
      });
      expect(wrapper.find('[data-testid="add-to-cart-button"]').exists()).toBe(
        false,
      );
    });
  });
});
