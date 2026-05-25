import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed, defineComponent, h, Suspense } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { defaultMountOptions } from '../../utils/component';
import ProductDetails from '../../../app/components/pages/ProductDetails.vue';

async function mountProductDetails(
  props: Record<string, unknown>,
  mountOptions: Parameters<typeof mount>[1] = {},
) {
  const Wrapper = defineComponent({
    components: { ProductDetails },
    props: Object.keys(props),
    setup(wrapperProps) {
      return () =>
        h(Suspense, null, {
          default: () => h(ProductDetails, wrapperProps),
        });
    },
  });
  const wrapper = mount(Wrapper, {
    ...defaultMountOptions,
    ...mountOptions,
    props,
    global: {
      ...defaultMountOptions.global,
      ...mountOptions.global,
      stubs: {
        ...(defaultMountOptions.global?.stubs ?? {}),
        ...(mountOptions.global?.stubs ?? {}),
      },
    },
  });
  await flushPromises();
  return wrapper;
}

const mockCanAccess = vi.fn(() => true);
vi.mock('../../../app/composables/useFeatureAccess', () => ({
  useFeatureAccess: () => ({ canAccess: mockCanAccess }),
}));

vi.mock('~/stores/cart', () => ({
  useCartStore: () => ({
    addItem: vi.fn(),
    isLoading: false,
  }),
}));

const showStockRef = ref(true);
vi.mock('../../../app/composables/useStockVisibility', () => ({
  useStockVisibility: () => ({ showStock: computed(() => showStockRef.value) }),
}));

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

vi.mock('@unhead/schema-org/vue', () => ({
  defineProduct: vi.fn(() => ({})),
  defineBreadcrumb: vi.fn(() => ({})),
}));

const { schemaOrgComposablePath } = vi.hoisted(() => {
  const nodeModule = require.resolve('nuxt-schema-org/schema');
  const pkgRoot = nodeModule.replace(/\/dist\/schema\..*$/, '');
  return {
    schemaOrgComposablePath: `${pkgRoot}/dist/runtime/app/composables/useSchemaOrg`,
  };
});
vi.mock(schemaOrgComposablePath, () => ({
  useSchemaOrg: vi.fn(),
}));

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
  Icon: { template: '<span />', props: ['name'] },
  NuxtIcon: { template: '<span />', props: ['name'] },
  ProductGallery: true,
  ProductDetailsSkeleton: { template: '<div data-testid="pdp-loading" />' },
  EmptyState: {
    template: '<div data-testid="pdp-error" />',
    props: ['icon', 'title', 'description', 'actionLabel', 'actionTo'],
  },
  AppBreadcrumbs: true,
  ErrorBoundary: { template: '<div><slot /></div>', props: ['section'] },
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

describe('ProductDetails out-of-stock', () => {
  beforeEach(() => {
    mockProduct.value = null;
    mockStatus.value = 'success';
    mockError.value = null;
    mockCanAccess.mockReturnValue(true);
    showStockRef.value = true;
  });

  it('OOS PDP hides qty + add-to-cart and shows OOS block', async () => {
    mockProduct.value = makeProduct({
      totalStock: { inStock: 0, oversellable: 0, totalStock: 0, static: 0 },
    });

    const wrapper = await mountProductDetails(
      { alias: 'test-product' },
      { global: { stubs: defaultStubs } },
    );

    expect(wrapper.find('[data-testid="pdp-actions"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="oos-block"]').exists()).toBe(true);
  });

  it('in-stock PDP shows qty + add-to-cart and hides OOS block', async () => {
    mockProduct.value = makeProduct({
      totalStock: { inStock: 5, oversellable: 0, totalStock: 5, static: 0 },
    });

    const wrapper = await mountProductDetails(
      { alias: 'test-product' },
      { global: { stubs: defaultStubs } },
    );

    expect(wrapper.find('[data-testid="pdp-actions"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="oos-block"]').exists()).toBe(false);
  });

  it('stock visibility off: OOS PDP still renders normal actions', async () => {
    showStockRef.value = false;
    mockProduct.value = makeProduct({
      totalStock: { inStock: 0, oversellable: 0, totalStock: 0, static: 0 },
    });

    const wrapper = await mountProductDetails(
      { alias: 'test-product' },
      { global: { stubs: defaultStubs } },
    );

    expect(wrapper.find('[data-testid="pdp-actions"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="oos-block"]').exists()).toBe(false);
  });
});
