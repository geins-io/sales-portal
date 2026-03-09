import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import { shallowMountComponent } from '../../utils/component';
import ProductDetails from '../../../app/components/pages/ProductDetails.vue';

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

vi.mock('~/stores/cart', () => ({
  useCartStore: () => ({
    addItem: vi.fn(),
    isLoading: false,
  }),
}));

// Mock useFetch to return controlled product data
const mockProduct = ref<Record<string, unknown> | null>(null);
const mockStatus = ref('success');
const mockError = ref<Error | null>(null);

const mockUseFetch = vi.fn(() => ({
  data: mockProduct,
  error: mockError,
  status: mockStatus,
  pending: ref(false),
  refresh: vi.fn(),
  execute: vi.fn(),
}));

vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: unknown[]) => mockUseFetch(...args),
}));

vi.stubGlobal('useFetch', (...args: unknown[]) => mockUseFetch(...args));

// Mock SEO/head composables
vi.mock('#app/composables/head', () => ({
  useHead: vi.fn(),
  useHeadSafe: vi.fn(),
  useServerHead: vi.fn(),
  useServerHeadSafe: vi.fn(),
  useSeoMeta: vi.fn(),
  useServerSeoMeta: vi.fn(),
  injectHead: vi.fn(),
}));

vi.stubGlobal('useHead', vi.fn());
vi.stubGlobal('useSeoMeta', vi.fn());
vi.stubGlobal('useSchemaOrg', vi.fn());
vi.stubGlobal(
  'defineProduct',
  vi.fn(() => ({})),
);
vi.stubGlobal(
  'defineBreadcrumb',
  vi.fn(() => ({})),
);

// Mock @unhead/schema-org/vue helpers (auto-imported by Nuxt)
vi.mock('@unhead/schema-org/vue', () => ({
  defineProduct: vi.fn(() => ({})),
  defineBreadcrumb: vi.fn(() => ({})),
}));

// Mock nuxt-schema-org runtime composable (auto-imported by Nuxt unimport)
// The unimport plugin resolves to the actual pnpm store path at transform time.
// We mock using the absolute path to the resolved module.
vi.mock(
  '/home/ali.halaki/Projects/geins/sales-portal/node_modules/.pnpm/nuxt-schema-org@5.0.10_@unhead+vue@2.1.4_vue@3.5.28_typescript@5.9.3___magicast@0.5.2_u_b3ea5f4000fe1ffd41f4f55dfbec252e/node_modules/nuxt-schema-org/dist/runtime/app/composables/useSchemaOrg',
  () => ({
    useSchemaOrg: vi.fn(),
  }),
);

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    productId: 1,
    name: 'Test Product',
    alias: 'test-product',
    articleNumber: 'ART-001',
    canonicalUrl: '/products/test-product',
    brand: { name: 'Test Brand' },
    unitPrice: {
      sellingPriceIncVat: 199,
      sellingPriceIncVatFormatted: '199,00 kr',
      isDiscounted: false,
    },
    totalStock: { inStock: 10, oversellable: 0, totalStock: 10, static: 0 },
    productImages: [{ fileName: 'product.jpg', isPrimary: true, url: '' }],
    skus: [{ skuId: 101, name: 'Default', stock: { totalStock: 10 } }],
    texts: { text1: 'Description', text2: 'Short description' },
    discountCampaigns: [],
    discountType: 'NONE',
    ...overrides,
  };
}

const defaultStubs = {
  ProductGallery: true,
  ProductDetailsSkeleton: {
    template: '<div data-testid="pdp-loading" />',
  },
  EmptyState: {
    template: '<div data-testid="pdp-error" />',
    props: ['icon', 'title', 'description', 'actionLabel', 'actionTo'],
  },
  AppBreadcrumbs: true,
  ErrorBoundary: {
    template: '<div><slot /></div>',
    props: ['section'],
  },
  SharedErrorBoundary: {
    template: '<div><slot /></div>',
    props: ['section'],
  },
  ProductTabs: true,
  ProductVariantSelector: true,
  ProductRelatedProducts: true,
  PriceDisplay: {
    template: '<span class="price-display" />',
    props: ['price', 'lowestPrice', 'discountType', 'campaignNames'],
  },
  SharedPriceDisplay: {
    template: '<span class="price-display" />',
    props: ['price', 'lowestPrice', 'discountType', 'campaignNames'],
  },
  StockBadge: {
    template: '<span class="stock-badge" />',
    props: ['stock'],
  },
  SharedStockBadge: {
    template: '<span class="stock-badge" />',
    props: ['stock'],
  },
  QuantityInput: {
    template: '<div class="quantity-input" />',
    props: ['modelValue', 'min', 'max'],
  },
  SharedQuantityInput: {
    template: '<div class="quantity-input" />',
    props: ['modelValue', 'min', 'max'],
  },
  GeinsImage: true,
  SharedGeinsImage: true,
};

describe('ProductDetails', () => {
  beforeEach(() => {
    mockProduct.value = null;
    mockStatus.value = 'success';
    mockError.value = null;
    mockHasFeature.mockReturnValue(false);
    mockCanAccess.mockReturnValue(true);
  });

  describe('campaign badges', () => {
    it('shows campaign badges when product has visible campaigns', () => {
      mockProduct.value = makeProduct({
        discountCampaigns: [{ name: 'Spring Sale', hideTitle: false }],
      });

      const wrapper = shallowMountComponent(ProductDetails, {
        props: { resolution: { productSlug: 'test-product' } },
        global: { stubs: defaultStubs },
      });

      const badges = wrapper.find('[data-testid="pdp-campaign-badges"]');
      expect(badges.exists()).toBe(true);
      expect(badges.text()).toContain('Spring Sale');
    });

    it('hides campaign badges when all campaigns have hideTitle true', () => {
      mockProduct.value = makeProduct({
        discountCampaigns: [{ name: 'Hidden', hideTitle: true }],
      });

      const wrapper = shallowMountComponent(ProductDetails, {
        props: { resolution: { productSlug: 'test-product' } },
        global: { stubs: defaultStubs },
      });

      expect(wrapper.find('[data-testid="pdp-campaign-badges"]').exists()).toBe(
        false,
      );
    });

    it('shows no badges when discountCampaigns is empty', () => {
      mockProduct.value = makeProduct({ discountCampaigns: [] });

      const wrapper = shallowMountComponent(ProductDetails, {
        props: { resolution: { productSlug: 'test-product' } },
        global: { stubs: defaultStubs },
      });

      expect(wrapper.find('[data-testid="pdp-campaign-badges"]').exists()).toBe(
        false,
      );
    });
  });

  describe('negotiated price banner', () => {
    it('shows info banner when discountType is EXTERNAL', () => {
      mockProduct.value = makeProduct({
        discountType: 'EXTERNAL',
        unitPrice: {
          sellingPriceIncVat: 150,
          sellingPriceIncVatFormatted: '150,00 kr',
          isDiscounted: true,
        },
      });

      const wrapper = shallowMountComponent(ProductDetails, {
        props: { resolution: { productSlug: 'test-product' } },
        global: { stubs: defaultStubs },
      });

      const banner = wrapper.find('[data-testid="negotiated-price-banner"]');
      expect(banner.exists()).toBe(true);
      expect(banner.text()).toContain('discount.negotiated_price_info');
    });

    it('does not show banner for SALE_PRICE', () => {
      mockProduct.value = makeProduct({ discountType: 'SALE_PRICE' });

      const wrapper = shallowMountComponent(ProductDetails, {
        props: { resolution: { productSlug: 'test-product' } },
        global: { stubs: defaultStubs },
      });

      expect(
        wrapper.find('[data-testid="negotiated-price-banner"]').exists(),
      ).toBe(false);
    });

    it('does not show banner for NONE', () => {
      mockProduct.value = makeProduct({ discountType: 'NONE' });

      const wrapper = shallowMountComponent(ProductDetails, {
        props: { resolution: { productSlug: 'test-product' } },
        global: { stubs: defaultStubs },
      });

      expect(
        wrapper.find('[data-testid="negotiated-price-banner"]').exists(),
      ).toBe(false);
    });
  });
});
