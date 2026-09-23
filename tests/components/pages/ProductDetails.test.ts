import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  assert,
} from 'vitest';
import { ref, defineComponent, h, Suspense } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { mountComponent, type MountOptionsFor } from '../../utils/component';
import ProductDetails from '../../../app/components/pages/ProductDetails.vue';
import type { DetailProduct } from '../../../shared/types/commerce';
import type { PublicTenantConfig } from '#shared/types/tenant-config';
import { mockIsCatalogMode } from '../../setup-components';
import { twoDimensionTree } from '../../fixtures/variant-trees';
import { useTenant } from '../../../app/composables/useTenant';

// The product arrives as a prop from the page — ProductDetails makes no
// request for it. Setup is still async (the related, sibling and CMS fetches
// run in it), so mount inside a Suspense boundary, full depth with the stubs
// below, and flush the microtask queue before asserting.
async function mountProductDetails(
  props: { product: DetailProduct; alias: string },
  mountOptions: MountOptionsFor<Component> = {},
) {
  // The wrapper closes over `props` instead of redeclaring them through
  // `Object.keys`, so they are checked against ProductDetails's own props.
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(Suspense, null, {
          default: () => h(ProductDetails, props),
        });
    },
  });
  const wrapper = mountComponent(Wrapper, mountOptions);
  await flushPromises();
  return wrapper;
}

// useTenant mock is provided by setup-components.ts

// navigateTo is still asserted here: the variant selector navigates to the
// picked sibling's URL. The canonical 301 and the content-miss recovery moved
// to the page with the fetch, and so did their cases.
const { navigateToMock } = vi.hoisted(() => ({
  navigateToMock: vi.fn<typeof navigateTo>(() => Promise.resolve()),
}));

vi.stubGlobal('navigateTo', navigateToMock);

const mockCanAccess = vi.fn<(featureName: string) => boolean>(() => true);

vi.mock('../../../app/composables/useFeatureAccess', () => ({
  useFeatureAccess: () => ({ canAccess: mockCanAccess }),
}));

vi.mock('~/stores/cart', () => ({
  useCartStore: () => ({
    addItem: vi.fn(),
    isLoading: false,
  }),
}));

const mockIsAuthenticated = ref(true);
const mockIsFavorite = vi.fn(() => false);
const mockToggleFavorite = vi.fn();

vi.mock('~/stores/auth', () => ({
  useAuthStore: () => ({
    get isAuthenticated() {
      return mockIsAuthenticated.value;
    },
  }),
}));

vi.mock('~/stores/favorites', () => ({
  useFavoritesStore: () => ({
    toggle: mockToggleFavorite,
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

// The product is a prop now. What is left to control here are the fetches
// ProductDetails still owns: the sibling products, the CMS area, and the
// related row. Anything asking for a product by alias is a regression — the
// page owns that call — and the last case in this file watches for it.

// CMS areas keyed by the areaName the tenant config names for the PDP slot.
// The mock took no arguments and answered every URL with the product, so the
// CMS fetch got the product back and no area could ever render.
const mockCmsAreas = new Map<string, { containers: unknown[] }>();

type AreaQuery = { areaName?: string };

function resolveAreaQuery(
  options?: Record<string, unknown>,
): AreaQuery | undefined {
  const raw = options?.query;
  if (raw != null && typeof raw === 'object' && 'value' in raw) {
    return (raw as { value: AreaQuery }).value;
  }
  return raw as AreaQuery | undefined;
}

// Sibling-variant products, as /api/products/by-ids answers them. Without a
// branch of its own the mock returned the product for this URL too, so
// `products` was always undefined and the variant price map stayed empty.
const mockSiblingProducts = ref<{ products: unknown[] } | null>(null);

const mockUseFetch = vi.fn(
  (urlOrFn?: unknown, options?: Record<string, unknown>) => {
    const url = typeof urlOrFn === 'function' ? urlOrFn() : urlOrFn;
    if (typeof url === 'string' && url.includes('/api/products/by-ids')) {
      return {
        data: mockSiblingProducts,
        error: ref(null),
        status: ref('success'),
        pending: ref(false),
        refresh: vi.fn(),
        execute: vi.fn(),
      };
    }
    if (typeof url === 'string' && url.includes('/api/cms/area')) {
      const areaName = resolveAreaQuery(options)?.areaName;
      return {
        data: ref(
          areaName !== undefined ? (mockCmsAreas.get(areaName) ?? null) : null,
        ),
        error: ref(null),
        status: ref('success'),
        pending: ref(false),
        refresh: vi.fn(),
        execute: vi.fn(),
      };
    }
    return {
      data: ref(null),
      error: ref(null),
      status: ref('success'),
      pending: ref(false),
      refresh: vi.fn(),
      execute: vi.fn(),
    };
  },
);

vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: Parameters<typeof mockUseFetch>) => mockUseFetch(...args),
}));

vi.stubGlobal('useFetch', mockUseFetch);

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
  navigateTo: (...args: Parameters<typeof navigateToMock>) =>
    navigateToMock(...args),
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
// One shared spy so a breadcrumb assertion reads the same call whichever
// resolution path the component takes for this auto-import.
const { defineBreadcrumbMock } = vi.hoisted(() => ({
  defineBreadcrumbMock: vi.fn(
    (_input: {
      itemListElement: () => Array<{ name: string; item?: string }>;
    }) => ({}),
  ),
}));
vi.stubGlobal('defineBreadcrumb', defineBreadcrumbMock);

// Mock @unhead/schema-org/vue helpers (auto-imported by Nuxt)
vi.mock('@unhead/schema-org/vue', () => ({
  defineProduct: vi.fn(() => ({})),
  defineBreadcrumb: defineBreadcrumbMock,
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

function makeProduct(overrides: Record<string, unknown> = {}): DetailProduct {
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
  } as unknown as DetailProduct;
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
    mockCanAccess.mockReturnValue(true);
    mockUseFetch.mockClear();
    navigateToMock.mockClear();
    mockCmsAreas.clear();
    mockSiblingProducts.value = null;
  });

  /**
   * The PDP resolves `CMS_SLOTS.PRODUCT_DETAIL` against the tenant config and
   * fetches the area that slot names. The spec mounted the component but never
   * configured the key, so no area rendered either way.
   *
   * `useCmsSlot` stays unmocked and the fetch stub answers on the areaName the
   * config produced, so pointing the slot elsewhere turns the first case red.
   */
  describe('cms zone on the product detail page', () => {
    const PDP_AREA = 'PDP Extra';

    const cmsStubs = {
      ...defaultStubs,
      CmsWidgetArea: {
        template: '<div class="cms-area" />',
        props: ['containers'],
      },
    };

    const originalCms = useTenant().tenant.value?.cms;

    function configurePdpSlot(areaName: string) {
      const { tenant } = useTenant();
      const current = tenant.value;
      assert.isDefined(current);
      tenant.value = {
        ...current,
        cms: { slots: { product_detail: { family: 'Product', areaName } } },
      };
    }

    afterEach(() => {
      // The setup fixture is shared across this file, so put `cms` back rather
      // than leaving later tests to run on whatever the last case configured.
      const { tenant } = useTenant();
      const current = tenant.value;
      assert.isDefined(current);
      tenant.value = { ...current, cms: originalCms };
    });

    it('renders the pdp zone for the area product_detail names', async () => {
      const product = makeProduct();
      configurePdpSlot(PDP_AREA);
      mockCmsAreas.set(PDP_AREA, { containers: [{ id: 'pdp' }] });

      const wrapper = await mountProductDetails(
        { product, alias: product.alias },
        { global: { stubs: cmsStubs } },
      );

      expect(wrapper.find('[data-testid="pdp-cms-area"]').exists()).toBe(true);
    });

    it('renders no pdp zone when product_detail names another area', async () => {
      const product = makeProduct();
      configurePdpSlot('Somewhere Else');
      mockCmsAreas.set(PDP_AREA, { containers: [{ id: 'pdp' }] });

      const wrapper = await mountProductDetails(
        { product, alias: product.alias },
        { global: { stubs: cmsStubs } },
      );

      expect(wrapper.find('[data-testid="pdp-cms-area"]').exists()).toBe(false);
    });
  });

  describe('purchase actions per mode and access', () => {
    // canPurchase is `canAccess('orderPlacement') && !isCatalogMode`. Each half
    // is asserted alone, so neither can start carrying the other.
    afterEach(() => {
      mockIsCatalogMode.value = false;
    });

    it('renders the add-to-cart action in commerce mode with orderPlacement access', async () => {
      const product = makeProduct();

      const wrapper = await mountProductDetails(
        { product, alias: product.alias },
        { global: { stubs: defaultStubs } },
      );

      expect(wrapper.find('[data-testid="pdp-actions"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="add-to-cart-button"]').exists()).toBe(
        true,
      );
    });

    it('hides the add-to-cart action when mode is catalog', async () => {
      mockIsCatalogMode.value = true;
      const product = makeProduct();

      const wrapper = await mountProductDetails(
        { product, alias: product.alias },
        { global: { stubs: defaultStubs } },
      );

      expect(wrapper.find('[data-testid="pdp-actions"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="add-to-cart-button"]').exists()).toBe(
        false,
      );
    });

    it('hides the add-to-cart action when orderPlacement access is denied', async () => {
      mockCanAccess.mockImplementation(
        (name: string) => name !== 'orderPlacement',
      );
      const product = makeProduct();

      const wrapper = await mountProductDetails(
        { product, alias: product.alias },
        { global: { stubs: defaultStubs } },
      );

      expect(wrapper.find('[data-testid="pdp-actions"]').exists()).toBe(false);
    });
  });

  describe('breadcrumbs', () => {
    const crumbs = async (overrides: Record<string, unknown>) => {
      const product = makeProduct(overrides);
      const wrapper = await mountProductDetails(
        { product, alias: product.alias },
        { global: { stubs: defaultStubs } },
      );
      return wrapper
        .findComponent({ name: 'AppBreadcrumbs' })
        .props('items') as Array<{ label: string; href?: string }>;
    };

    it('renders the full trail: Home, ancestors, primary category, product', async () => {
      const items = await crumbs({
        name: 'Insexskruv',
        canonicalUrl: '/se/sv/p/fastelement/testkategori/insexskruv',
        ancestors: [
          { name: 'Fästelement', canonicalUrl: '/se/sv/c/fastelement' },
        ],
        primaryCategory: {
          name: 'Testkategori',
          alias: 'testkategori',
          canonicalUrl: '/se/sv/c/fastelement/testkategori',
        },
      });

      expect(items.map((i) => i.label)).toEqual([
        'common.home',
        'Fästelement',
        'Testkategori',
        'Insexskruv',
      ]);
    });

    it('links the category crumb to its canonical, not the 301-ing short alias', async () => {
      // `/se/sv/c/testkategori` — what categoryPath('/' + alias) produced —
      // answers 301 to the nested canonical on every nested category.
      const items = await crumbs({
        ancestors: [
          { name: 'Fästelement', canonicalUrl: '/se/sv/c/fastelement' },
        ],
        primaryCategory: {
          name: 'Testkategori',
          alias: 'testkategori',
          canonicalUrl: '/se/sv/c/fastelement/testkategori',
        },
      });

      expect(items.find((i) => i.label === 'Testkategori')?.href).toBe(
        '/se/sv/c/fastelement/testkategori',
      );
      expect(items.find((i) => i.label === 'Fästelement')?.href).toBe(
        '/se/sv/c/fastelement',
      );
    });

    it('normalizes the prefix-less canonical shape other tenants return', async () => {
      const items = await crumbs({
        ancestors: [
          {
            name: 'Säkerhet och övrigt',
            canonicalUrl: '/se/sv/sakerhet-och-ovrigt',
          },
        ],
        primaryCategory: {
          name: 'Skyddsutrustning',
          alias: 'skyddsutrustning',
          canonicalUrl: '/se/sv/sakerhet-och-ovrigt/skyddsutrustning',
        },
      });

      expect(items.map((i) => i.href)).toEqual([
        '/se/sv/',
        '/se/sv/c/sakerhet-och-ovrigt',
        '/se/sv/c/sakerhet-och-ovrigt/skyddsutrustning',
        undefined,
      ]);
    });

    it('falls back to the short trail when no ancestors were resolved', async () => {
      // An unresolvable chain arrives as [], never partially, so the page
      // renders what it can prove rather than a trail with a gap.
      const items = await crumbs({
        name: 'Insexskruv',
        ancestors: [],
        primaryCategory: {
          name: 'Testkategori',
          alias: 'testkategori',
          canonicalUrl: '/se/sv/c/fastelement/testkategori',
        },
      });

      expect(items.map((i) => i.label)).toEqual([
        'common.home',
        'Testkategori',
        'Insexskruv',
      ]);
    });

    it('feeds the same items to the JSON-LD BreadcrumbList', async () => {
      // The structured data maps over this array, so a truncated trail would
      // reach crawlers too. Asserting the items is asserting both.
      const items = await crumbs({
        name: 'Insexskruv',
        ancestors: [
          { name: 'Fästelement', canonicalUrl: '/se/sv/c/fastelement' },
        ],
        primaryCategory: {
          name: 'Testkategori',
          alias: 'testkategori',
          canonicalUrl: '/se/sv/c/fastelement/testkategori',
        },
      });

      const lastCall = defineBreadcrumbMock.mock.calls.at(-1);
      assert(lastCall, 'defineBreadcrumb was never called');
      const breadcrumbArg = lastCall[0].itemListElement();

      expect(breadcrumbArg.map((e) => e.name)).toEqual([
        'common.home',
        'Fästelement',
        'Testkategori',
        'Insexskruv',
      ]);
      // ...and stays in step with what the page renders.
      expect(breadcrumbArg.map((e) => e.name)).toEqual(
        items.map((i) => i.label),
      );
      expect(breadcrumbArg.map((e) => e.item)).toEqual(
        items.map((i) => i.href),
      );
    });
  });

  describe('migrated entity-URL hrefs', () => {
    it('builds the breadcrumb category href via categoryPath', async () => {
      const product = makeProduct({
        canonicalUrl: '/se/sv/test-product',
        primaryCategory: { name: 'Material', alias: 'material' },
      });

      const wrapper = await mountProductDetails(
        { product, alias: product.alias },
        { global: { stubs: defaultStubs } },
      );

      const breadcrumbs = wrapper.findComponent({ name: 'AppBreadcrumbs' });
      const items = breadcrumbs.props('items') as Array<{
        label: string;
        href?: string;
      }>;
      // categoryPath('/material') -> '/c/material', localePath -> '/se/sv/c/material'
      // Find the specific category breadcrumb by its label so a wrong href on an
      // unrelated item cannot make the assertion pass.
      const categoryItem = items.find((i) => i.label === 'Material');
      expect(categoryItem).toBeDefined();
      expect(categoryItem?.href).toBe('/se/sv/c/material');
    });

    it('navigates to the productPath-built variant URL on variant change', async () => {
      const product = makeProduct({
        alias: 'grenror-150-150-88',
        canonicalUrl: '/se/sv/p/grenror-150-150-88',
        variantDimensions: [{ dimension: 'Variant', value: '88' }],
        variantGroup: {
          variants: [
            { alias: 'grenror-150-150-88', dimension: 'Variant', value: '88' },
            { alias: 'grenror-150-150-90', dimension: 'Variant', value: '90' },
          ],
        },
      });
      // Route params drive the variant nav path segments.
      pdpRoute.params = {
        alias: ['material', 'grenror', 'grenror-150-150-88'],
      };

      const Selector = defineComponent({
        props: ['modelValue', 'variantDimensions', 'variants'],
        emits: ['update:modelValue'],
        setup(_p, { emit }) {
          // Simulate the user picking the 90 variant after mount.
          return () =>
            h('button', {
              'data-testid': 'pick-variant',
              onClick: () => emit('update:modelValue', { Variant: '90' }),
            });
        },
      });

      const wrapper = await mountProductDetails(
        { product, alias: product.alias },
        {
          global: { stubs: { ...defaultStubs, VariantSelector: Selector } },
        },
      );

      navigateToMock.mockClear();
      await wrapper.find('[data-testid="pick-variant"]').trigger('click');
      await flushPromises();

      // productPath('/material/grenror/grenror-150-150-90') ->
      // '/p/material/grenror/grenror-150-150-90', localePath -> '/se/sv/p/...'
      expect(navigateToMock).toHaveBeenCalledWith(
        '/se/sv/p/material/grenror/grenror-150-150-90',
      );
      pdpRoute.params = {};
    });
  });

  describe('campaign badges', () => {
    it('shows campaign badges when product has visible campaigns', async () => {
      const product = makeProduct({
        discountCampaigns: [{ name: 'Spring Sale', hideTitle: false }],
      });

      const wrapper = await mountProductDetails(
        { product, alias: product.alias },
        { global: { stubs: defaultStubs } },
      );

      const badges = wrapper.find('[data-testid="pdp-campaign-badges"]');
      expect(badges.exists()).toBe(true);
      expect(badges.text()).toContain('Spring Sale');
    });

    it('hides campaign badges when all campaigns have hideTitle true', async () => {
      const product = makeProduct({
        discountCampaigns: [{ name: 'Hidden', hideTitle: true }],
      });

      const wrapper = await mountProductDetails(
        { product, alias: product.alias },
        { global: { stubs: defaultStubs } },
      );

      expect(wrapper.find('[data-testid="pdp-campaign-badges"]').exists()).toBe(
        false,
      );
    });

    it('shows no badges when discountCampaigns is empty', async () => {
      const product = makeProduct({ discountCampaigns: [] });

      const wrapper = await mountProductDetails(
        { product, alias: product.alias },
        { global: { stubs: defaultStubs } },
      );

      expect(wrapper.find('[data-testid="pdp-campaign-badges"]').exists()).toBe(
        false,
      );
    });
  });

  describe('negotiated price banner', () => {
    it('shows info banner when discountType is EXTERNAL', async () => {
      const product = makeProduct({
        discountType: 'EXTERNAL',
        unitPrice: {
          sellingPriceIncVat: 150,
          sellingPriceIncVatFormatted: '150,00 kr',
          isDiscounted: true,
        },
      });

      const wrapper = await mountProductDetails(
        { product, alias: product.alias },
        { global: { stubs: defaultStubs } },
      );

      const banner = wrapper.find('[data-testid="negotiated-price-banner"]');
      expect(banner.exists()).toBe(true);
      expect(banner.text()).toContain('discount.negotiated_price_info');
    });

    it('does not show banner for SALE_PRICE', async () => {
      const product = makeProduct({ discountType: 'SALE_PRICE' });

      const wrapper = await mountProductDetails(
        { product, alias: product.alias },
        { global: { stubs: defaultStubs } },
      );

      expect(
        wrapper.find('[data-testid="negotiated-price-banner"]').exists(),
      ).toBe(false);
    });

    it('does not show banner for NONE', async () => {
      const product = makeProduct({ discountType: 'NONE' });

      const wrapper = await mountProductDetails(
        { product, alias: product.alias },
        { global: { stubs: defaultStubs } },
      );

      expect(
        wrapper.find('[data-testid="negotiated-price-banner"]').exists(),
      ).toBe(false);
    });
  });

  // The variant sheet renders one price per row, and the row must answer to the
  // inc/ex VAT switcher. The parent owns half of that: it resolves each sibling
  // product and hands the row its price. Passing a single pre-picked string here
  // makes the preference unreachable inside the selector, whatever the selector
  // does with it.
  describe('variant price data handed to the selector', () => {
    function captureProps(sink: { value: Record<string, unknown> }) {
      return defineComponent({
        props: [
          'modelValue',
          'variantDimensions',
          'variants',
          'variantProducts',
          'priceIncVatFormatted',
          'priceExVatFormatted',
        ],
        setup(p) {
          return () => {
            sink.value = { ...p };
            return h('div', { 'data-testid': 'variant-selector-stub' });
          };
        },
      });
    }

    it('passes both VAT variants of each sibling price, not one pre-picked string', async () => {
      const sink = { value: {} as Record<string, unknown> };
      const product = makeProduct({
        alias: 'grenror-150-150-88',
        variantDimensions: [{ dimension: 'Variant', value: '88' }],
        variantGroup: {
          variants: [
            { alias: 'grenror-150-150-88', dimension: 'Variant', value: '88' },
            { alias: 'grenror-150-150-90', dimension: 'Variant', value: '90' },
          ],
        },
      });
      mockSiblingProducts.value = {
        products: [
          {
            productId: 2,
            alias: 'grenror-150-150-90',
            name: 'Grenrör 150/150-90',
            articleNumber: 'S1-233-090',
            unitPrice: {
              sellingPriceIncVatFormatted: '950 kr',
              sellingPriceExVatFormatted: '760 kr',
            },
          },
        ],
      };

      await mountProductDetails(
        { product, alias: product.alias },
        {
          global: {
            stubs: { ...defaultStubs, VariantSelector: captureProps(sink) },
          },
        },
      );

      expect(sink.value.variantProducts).toMatchObject({
        'grenror-150-150-90': {
          priceIncVatFormatted: '950 kr',
          priceExVatFormatted: '760 kr',
        },
      });
    });

    it('passes both VAT variants of the parent fallback price', async () => {
      const sink = { value: {} as Record<string, unknown> };
      const product = makeProduct({
        alias: 'grenror-150-150-88',
        variantDimensions: [{ dimension: 'Variant', value: '88' }],
        variantGroup: {
          variants: [
            { alias: 'grenror-150-150-88', dimension: 'Variant', value: '88' },
            { alias: 'grenror-150-150-90', dimension: 'Variant', value: '90' },
          ],
        },
        unitPrice: {
          sellingPriceIncVat: 1200,
          sellingPriceIncVatFormatted: '1 200 kr',
          sellingPriceExVatFormatted: '960 kr',
          isDiscounted: false,
        },
      });

      await mountProductDetails(
        { product, alias: product.alias },
        {
          global: {
            stubs: { ...defaultStubs, VariantSelector: captureProps(sink) },
          },
        },
      );

      expect(sink.value.priceIncVatFormatted).toBe('1 200 kr');
      expect(sink.value.priceExVatFormatted).toBe('960 kr');
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
      const product = makeProduct({
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
        { product, alias: product.alias },
        { global: { stubs: stubsWith(sink) } },
      );

      expect(sink.value).toEqual({ Variant: '88' });
    });

    it('falls back to the variant label when value is absent', async () => {
      const sink = { value: {} as Record<string, string> };
      const product = makeProduct({
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
        { product, alias: product.alias },
        { global: { stubs: stubsWith(sink) } },
      );

      expect(sink.value).toEqual({ Variant: '88' });
    });

    it('leaves the selection empty when no variant alias matches the product', async () => {
      const sink = { value: { seeded: 'no' } as Record<string, string> };
      const product = makeProduct({
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
        { product, alias: product.alias },
        { global: { stubs: stubsWith(sink) } },
      );

      expect(sink.value).toEqual({});
    });
  });

  // Two variant dimensions arrive as a tree: the alias sits under an
  // alias-less node, so nothing on the top level can be navigated to.
  describe('two-dimension variant tree', () => {
    const m12 = () =>
      makeProduct({
        productId: 1008,
        alias: 'sexkantskruv-m12x60-din-933-rostfri-a2',
        variantDimensions: [
          { dimension: 'Längd', value: '60 mm' },
          { dimension: 'Gänga', value: 'm12' },
        ],
        variantGroup: { variants: twoDimensionTree },
      });

    function pickingSelector(
      sink: { value: Record<string, unknown> },
      pick: Record<string, string>,
    ) {
      return defineComponent({
        props: ['modelValue', 'variantDimensions', 'variants', 'combinations'],
        emits: ['update:modelValue'],
        setup(p, { emit }) {
          return () => {
            sink.value = { ...p };
            return h('button', {
              'data-testid': 'pick-variant',
              onClick: () =>
                emit('update:modelValue', {
                  ...(p.modelValue as Record<string, string>),
                  ...pick,
                }),
            });
          };
        },
      });
    }

    async function mountPicking(pick: Record<string, string>) {
      const sink = { value: {} as Record<string, unknown> };
      const product = m12();
      pdpRoute.params = {
        alias: [
          'testkategori-l3',
          'testkategori-l6',
          'sexkantskruv-m12x60-din-933-rostfri-a2',
        ],
      };
      const wrapper = await mountProductDetails(
        { product, alias: product.alias },
        {
          global: {
            stubs: {
              ...defaultStubs,
              VariantSelector: pickingSelector(sink, pick),
            },
          },
        },
      );
      navigateToMock.mockClear();
      return { wrapper, sink };
    }

    afterEach(() => {
      pdpRoute.params = {};
    });

    it('seeds both dimensions from the current product', async () => {
      const { sink } = await mountPicking({});

      expect(sink.value.modelValue).toEqual({ Gänga: 'm12', Längd: '60 mm' });
    });

    it("navigates to the picked sibling's own canonical", async () => {
      mockSiblingProducts.value = {
        products: [
          {
            productId: 1007,
            alias: 'sexkantskruv-m10x50-din-933-rostfri-a2',
            canonicalUrl:
              '/se/sv/fastelement/sexkantskruv-m10x50-din-933-rostfri-a2',
          },
        ],
      };
      const { wrapper } = await mountPicking({ Gänga: 'm10' });

      await wrapper.find('[data-testid="pick-variant"]').trigger('click');
      await flushPromises();

      expect(navigateToMock).toHaveBeenCalledWith(
        '/se/sv/p/fastelement/sexkantskruv-m10x50-din-933-rostfri-a2',
      );
    });

    it('swaps the last segment while the sibling data has not landed', async () => {
      const { wrapper } = await mountPicking({ Längd: '40 mm' });

      await wrapper.find('[data-testid="pick-variant"]').trigger('click');
      await flushPromises();

      expect(navigateToMock).toHaveBeenCalledWith(
        '/se/sv/p/testkategori-l3/testkategori-l6/sexkantskruv-m8x40-din-933-rostfri-a2',
      );
    });

    it('asks for every sibling below the top level, not the top nodes', async () => {
      await mountPicking({});

      const byIds = mockUseFetch.mock.calls.find(
        ([url]) => url === '/api/products/by-ids',
      );
      const query = (byIds?.[1] as { query: { value: { ids: string } } }).query
        .value;
      expect(query.ids).toBe('1007,1006');
    });
  });

  // The page loads the product and hands it down. If this component ever asks
  // for one again, every PDP pays for two requests — so the mock is watched for
  // a product-by-alias url rather than trusted not to see one.
  describe('the product it is given', () => {
    it('makes no request for the product', async () => {
      const product = makeProduct();

      await mountProductDetails(
        { product, alias: product.alias },
        { global: { stubs: defaultStubs } },
      );

      // The by-ids and related endpoints live under the same prefix, so the
      // check is for this product's own url, not for the prefix.
      const urls = mockUseFetch.mock.calls.map(([urlOrFn]) =>
        typeof urlOrFn === 'function' ? urlOrFn() : urlOrFn,
      );
      expect(urls).not.toContain(`/api/products/${product.alias}`);
    });

    it("builds its own requests from the URL alias, not the product's", async () => {
      // A locale fallback answers the requested address with the
      // default-language product, whose own alias is a different one. Asking
      // under the product's alias would quietly move every follow-up request
      // to the other locale's product.
      const product = makeProduct({ alias: 'wood-screw-sv' });

      await mountProductDetails(
        { product, alias: 'wood-screw-se' },
        { global: { stubs: defaultStubs } },
      );

      const urls = mockUseFetch.mock.calls.map(([urlOrFn]) =>
        typeof urlOrFn === 'function' ? urlOrFn() : urlOrFn,
      );
      expect(urls).toContain('/api/products/wood-screw-se/related');
      expect(urls).not.toContain('/api/products/wood-screw-sv/related');
    });
  });

  // The star is the only thing on this row with an on/off state, and its fill
  // is what carries it. ProductCard asserts the same pair on its own button.
  describe('the favourite star', () => {
    let originalFeatures: PublicTenantConfig['features'];

    beforeEach(() => {
      const { tenant } = useTenant();
      assert.isDefined(tenant.value);
      originalFeatures = tenant.value.features;
      tenant.value.features = {
        ...originalFeatures,
        wishlist: { enabled: true },
      };
      mockIsAuthenticated.value = true;
      mockIsFavorite.mockReturnValue(false);
    });

    afterEach(() => {
      const { tenant } = useTenant();
      assert.isDefined(tenant.value);
      tenant.value.features = originalFeatures;
    });

    // The star reaches the DOM through lucide's inner `Icon`, which
    // defaultStubs replaces. `fill` is not one of the stub's props, so it
    // lands as an attribute and the binding under test stays assertable.
    async function mountFavouriteButton() {
      const product = makeProduct();
      const wrapper = await mountProductDetails(
        { product, alias: product.alias },
        { global: { stubs: defaultStubs } },
      );
      return wrapper.get('[data-testid="pdp-save-favourite"]');
    }

    it('fills the star when the product is a favourite', async () => {
      mockIsFavorite.mockReturnValue(true);

      const button = await mountFavouriteButton();

      expect(button.attributes('data-favorited')).toBe('true');
      expect(button.get('[data-name="star"]').attributes('fill')).toBe(
        'currentColor',
      );
    });

    it('leaves the star outlined when the product is not a favourite', async () => {
      const button = await mountFavouriteButton();

      expect(button.attributes('data-favorited')).toBe('false');
      expect(button.get('[data-name="star"]').attributes('fill')).toBe('none');
    });
  });
});
