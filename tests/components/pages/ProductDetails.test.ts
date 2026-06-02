import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, defineComponent, h, Suspense } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { defaultMountOptions } from '../../utils/component';
import ProductDetails from '../../../app/components/pages/ProductDetails.vue';

// ProductDetails uses `await useFetch(...)` so the setup is async. Wrap it
// in a Suspense boundary, mount full-depth (stubs provided via global.stubs
// cover every heavy child), and flush the microtask queue before asserting.
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

// useTenant mock is provided by setup-components.ts

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

// useLocaleAlternates auto-imports useRouter/useRoute from #app/composables/router
// (not the global stub) and registers an afterEach hook on the client; without an
// afterEach the composable throws and aborts the component setup. Override the
// module mock so the router carries afterEach and the route path is mutable per
// test (setRoutePath drives it below).
const { pdpRoute } = vi.hoisted(() => ({
  pdpRoute: {
    path: '/',
    params: {},
    query: {},
    hash: '',
    fullPath: '/',
    name: 'slug',
  },
}));
vi.mock('#app/composables/router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    afterEach: vi.fn(),
  }),
  useRoute: () => pdpRoute,
}));

// useState (used by useLocaleAlternates) needs a live Nuxt instance the
// component tier does not provide; back it with a plain ref store.
const { stubUseState } = vi.hoisted(() => ({
  // A plain { value } box is enough; useLocaleAlternates only reads/writes
  // `.value`. Avoids needing Vue's ref inside the hoisted (pre-import) factory.
  stubUseState: (_key: string, init?: () => unknown) => ({
    value: typeof init === 'function' ? init() : undefined,
  }),
}));
vi.stubGlobal('useState', stubUseState);
vi.mock('#app/composables/state', () => ({ useState: stubUseState }));

// Override the global useLocaleMarket mock so localePath prepends the
// /se/sv prefix used by the live-verified canonical fixtures below. The
// real localePath re-adds the current /{market}/{locale}/ prefix to the
// locale-free path returned by the route helpers.
vi.mock('../../../app/composables/useLocaleMarket', () => ({
  useLocaleMarket: () => ({
    currentMarket: { value: 'se' },
    currentLocale: { value: 'sv' },
    localePath: (path: string) =>
      `/se/sv${path.startsWith('/') ? path : '/' + path}`,
    localeQuery: { value: {} },
    getCleanPath: () => '/',
    switchLocale: vi.fn(),
    switchMarket: vi.fn(),
  }),
}));

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

// Mock nuxt-schema-org runtime composable (auto-imported by Nuxt unimport).
// Resolve the path dynamically so the mock isn't tied to a specific pnpm store hash.
const { schemaOrgComposablePath } = vi.hoisted(() => {
  const nodeModule = require.resolve('nuxt-schema-org/schema'); // exported subpath
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
  Icon: {
    template: '<span class="icon" :data-name="name" />',
    props: ['name'],
  },
  NuxtIcon: {
    template: '<span class="icon" :data-name="name" />',
    props: ['name'],
  },
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
    mockCanAccess.mockReturnValue(true);
  });

  describe('canonical URL self-correction', () => {
    async function setRoutePath(path: string): Promise<{
      restore: () => void;
    }> {
      const router = (
        (await import('#app/composables/router')) as unknown as {
          useRoute: () => { path: string };
        }
      ).useRoute() as { path: string };
      const originalPath = router.path;
      router.path = path;
      return { restore: () => (router.path = originalPath) };
    }

    it('normalizes a prefix-less canonical to the routable /p/ form', async () => {
      // Geins returns a canonicalUrl without our `/p/` product-route segment
      // (e.g. /se/sv/material/grenror/grenror-150-150-88). It must be
      // normalized to the routable /p/ path, not written raw (the raw form
      // 404s on refresh or in-app nav).
      const { restore } = await setRoutePath('/se/sv/p/grenror-150-150-88');
      const spy = vi
        .spyOn(window.history, 'replaceState')
        .mockImplementation(() => {});
      mockProduct.value = makeProduct({
        canonicalUrl: '/se/sv/material/grenror/grenror-150-150-88',
      });

      try {
        await mountProductDetails(
          { alias: 'grenror-150-150-88' },
          { global: { stubs: defaultStubs } },
        );
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0]?.[2]).toBe(
          '/se/sv/p/material/grenror/grenror-150-150-88',
        );
      } finally {
        spy.mockRestore();
        restore();
      }
    });

    it('rewrites to the routable /p/ form when canonicalUrl differs in the same prefix', async () => {
      const { restore } = await setRoutePath(
        '/se/sv/p/wood-screw-stainless-steel-10-mm-se',
      );
      const spy = vi
        .spyOn(window.history, 'replaceState')
        .mockImplementation(() => {});
      mockProduct.value = makeProduct({
        canonicalUrl: '/se/sv/p/wood-screw-stainless-steel-10-mm-en',
      });

      try {
        await mountProductDetails(
          { alias: 'wood-screw-stainless-steel-10-mm-se' },
          { global: { stubs: defaultStubs } },
        );
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0]?.[2]).toBe(
          '/se/sv/p/wood-screw-stainless-steel-10-mm-en',
        );
      } finally {
        spy.mockRestore();
        restore();
      }
    });

    it('does not rewrite the URL when the routable target equals the route path', async () => {
      const { restore } = await setRoutePath('/se/sv/p/test-product');
      const spy = vi
        .spyOn(window.history, 'replaceState')
        .mockImplementation(() => {});
      mockProduct.value = makeProduct({ canonicalUrl: '/se/sv/test-product' });

      try {
        await mountProductDetails(
          { alias: 'test-product' },
          { global: { stubs: defaultStubs } },
        );
        expect(spy).not.toHaveBeenCalled();
      } finally {
        spy.mockRestore();
        restore();
      }
    });

    it('does not rewrite when the canonical URL is in a different locale (fallback case)', async () => {
      // Cross-locale: route is /se/en/... but canonical came back as /se/sv/...
      // because the locale fallback served default-language content. Rewriting
      // would yank the user out of EN, defeating their intent.
      const { restore } = await setRoutePath(
        '/se/en/p/wood-screw-stainless-steel-10-mm-se',
      );
      const spy = vi
        .spyOn(window.history, 'replaceState')
        .mockImplementation(() => {});
      mockProduct.value = makeProduct({
        canonicalUrl: '/se/sv/p/kategori-1/wood-screw-stainless-steel-10-mm-se',
      });

      try {
        await mountProductDetails(
          { alias: 'wood-screw-stainless-steel-10-mm-se' },
          { global: { stubs: defaultStubs } },
        );
        expect(spy).not.toHaveBeenCalled();
      } finally {
        spy.mockRestore();
        restore();
      }
    });
  });

  describe('campaign badges', () => {
    it('shows campaign badges when product has visible campaigns', async () => {
      mockProduct.value = makeProduct({
        discountCampaigns: [{ name: 'Spring Sale', hideTitle: false }],
      });

      const wrapper = await mountProductDetails(
        { alias: 'test-product' },
        { global: { stubs: defaultStubs } },
      );

      const badges = wrapper.find('[data-testid="pdp-campaign-badges"]');
      expect(badges.exists()).toBe(true);
      expect(badges.text()).toContain('Spring Sale');
    });

    it('hides campaign badges when all campaigns have hideTitle true', async () => {
      mockProduct.value = makeProduct({
        discountCampaigns: [{ name: 'Hidden', hideTitle: true }],
      });

      const wrapper = await mountProductDetails(
        { alias: 'test-product' },
        { global: { stubs: defaultStubs } },
      );

      expect(wrapper.find('[data-testid="pdp-campaign-badges"]').exists()).toBe(
        false,
      );
    });

    it('shows no badges when discountCampaigns is empty', async () => {
      mockProduct.value = makeProduct({ discountCampaigns: [] });

      const wrapper = await mountProductDetails(
        { alias: 'test-product' },
        { global: { stubs: defaultStubs } },
      );

      expect(wrapper.find('[data-testid="pdp-campaign-badges"]').exists()).toBe(
        false,
      );
    });
  });

  describe('negotiated price banner', () => {
    it('shows info banner when discountType is EXTERNAL', async () => {
      mockProduct.value = makeProduct({
        discountType: 'EXTERNAL',
        unitPrice: {
          sellingPriceIncVat: 150,
          sellingPriceIncVatFormatted: '150,00 kr',
          isDiscounted: true,
        },
      });

      const wrapper = await mountProductDetails(
        { alias: 'test-product' },
        { global: { stubs: defaultStubs } },
      );

      const banner = wrapper.find('[data-testid="negotiated-price-banner"]');
      expect(banner.exists()).toBe(true);
      expect(banner.text()).toContain('discount.negotiated_price_info');
    });

    it('does not show banner for SALE_PRICE', async () => {
      mockProduct.value = makeProduct({ discountType: 'SALE_PRICE' });

      const wrapper = await mountProductDetails(
        { alias: 'test-product' },
        { global: { stubs: defaultStubs } },
      );

      expect(
        wrapper.find('[data-testid="negotiated-price-banner"]').exists(),
      ).toBe(false);
    });

    it('does not show banner for NONE', async () => {
      mockProduct.value = makeProduct({ discountType: 'NONE' });

      const wrapper = await mountProductDetails(
        { alias: 'test-product' },
        { global: { stubs: defaultStubs } },
      );

      expect(
        wrapper.find('[data-testid="negotiated-price-banner"]').exists(),
      ).toBe(false);
    });
  });

  describe('current variant seeding', () => {
    // Capture the modelValue the variant selector receives. Reads it in the
    // render fn so the latest value (after the immediate seed watch) wins.
    // The template tag is <VariantSelector>, so that is the stub key.
    function captureSelector(sink: { value: Record<string, string> }) {
      return defineComponent({
        props: ['modelValue', 'variantDimensions', 'variants'],
        setup(p) {
          return () => {
            sink.value = {
              ...((p.modelValue as Record<string, string>) ?? {}),
            };
            return h('div', { 'data-testid': 'variant-selector-stub' });
          };
        },
      });
    }

    function stubsWith(sink: { value: Record<string, string> }) {
      return { ...defaultStubs, VariantSelector: captureSelector(sink) };
    }

    it('seeds the selector with the active sibling variant', async () => {
      const sink = { value: {} as Record<string, string> };
      mockProduct.value = makeProduct({
        alias: 'grenror-150-150-88',
        variantDimensions: [{ dimension: 'Variant', value: '88' }],
        variantGroup: {
          variants: [
            { alias: 'grenror-150-150-88', dimension: 'Variant', value: '88' },
            { alias: 'grenror-150-150-90', dimension: 'Variant', value: '90' },
          ],
        },
      });

      await mountProductDetails(
        { alias: 'grenror-150-150-88' },
        { global: { stubs: stubsWith(sink) } },
      );

      expect(sink.value).toEqual({ Variant: '88' });
    });

    it('falls back to the variant label when value is absent', async () => {
      const sink = { value: {} as Record<string, string> };
      mockProduct.value = makeProduct({
        alias: 'grenror-150-150-88',
        variantDimensions: [{ dimension: 'Variant', value: '88' }],
        variantGroup: {
          variants: [
            { alias: 'grenror-150-150-88', dimension: 'Variant', label: '88' },
            { alias: 'grenror-150-150-90', dimension: 'Variant', label: '90' },
          ],
        },
      });

      await mountProductDetails(
        { alias: 'grenror-150-150-88' },
        { global: { stubs: stubsWith(sink) } },
      );

      expect(sink.value).toEqual({ Variant: '88' });
    });

    it('leaves the selection empty when no variant alias matches the product', async () => {
      const sink = { value: { seeded: 'no' } as Record<string, string> };
      mockProduct.value = makeProduct({
        alias: 'parent-product',
        variantDimensions: [{ dimension: 'Variant', value: 'A' }],
        variantGroup: {
          variants: [
            { alias: 'child-a', dimension: 'Variant', value: 'A' },
            { alias: 'child-b', dimension: 'Variant', value: 'B' },
          ],
        },
      });

      await mountProductDetails(
        { alias: 'parent-product' },
        { global: { stubs: stubsWith(sink) } },
      );

      expect(sink.value).toEqual({});
    });
  });
});
