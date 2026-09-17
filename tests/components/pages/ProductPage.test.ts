import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ref,
  nextTick,
  defineComponent,
  h,
  Suspense,
  type Component,
} from 'vue';
import { flushPromises } from '@vue/test-utils';
import { mountComponent, type MountOptionsFor } from '../../utils/component';
import ProductPage from '../../../app/pages/p/[...alias].vue';
import type { DetailProduct } from '../../../shared/types/commerce';

// ---------------------------------------------------------------------------
// The product route.
//
// It loads the product once and then decides two things: which page component
// the product gets, and whether the URL the visitor is on is the right one.
// Both used to live inside ProductDetails; the cases that cover the canonical
// 301 and the content-miss recovery moved here with them, unchanged.
//
// The page components are stubbed to a marker each. What is asserted here is
// the choice and the URL handling, never what a page renders.
// ---------------------------------------------------------------------------

const mockProduct = ref<DetailProduct | null>(null);
const mockStatus = ref('success');
const mockError = ref<Error | null>(null);

const mockUseFetch = vi.fn((urlOrFn?: unknown) => {
  const url = typeof urlOrFn === 'function' ? urlOrFn() : urlOrFn;
  if (typeof url === 'string' && url.startsWith('/api/products/')) {
    return {
      data: mockProduct,
      error: mockError,
      status: mockStatus,
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
});

vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: Parameters<typeof mockUseFetch>) => mockUseFetch(...args),
}));
vi.stubGlobal('useFetch', mockUseFetch);

// navigateTo and recoverEntityUrl are the redirect and recovery boundaries.
// Both are spies: the assertions watch the spy, never real navigation.
const { navigateToMock, recoverEntityUrlMock } = vi.hoisted(() => ({
  navigateToMock: vi.fn<typeof navigateTo>(() => Promise.resolve()),
  recoverEntityUrlMock: vi.fn<(path: string) => Promise<void>>(() =>
    Promise.resolve(),
  ),
}));

vi.stubGlobal('navigateTo', navigateToMock);
vi.mock('../../../app/composables/useEntityUrlRecovery', () => ({
  recoverEntityUrl: (...args: Parameters<typeof recoverEntityUrlMock>) =>
    recoverEntityUrlMock(...args),
}));
vi.stubGlobal('recoverEntityUrl', recoverEntityUrlMock);

// The route the page reads its alias and its current path from.
const { pdpRoute } = vi.hoisted(() => ({
  pdpRoute: {
    path: '/se/sv/p/test-product',
    params: { alias: ['se', 'sv', 'p', 'test-product'] } as {
      alias: string[] | string;
    },
    query: {},
    hash: '',
    fullPath: '/se/sv/p/test-product',
    name: 'p-alias',
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
vi.stubGlobal('useRoute', () => pdpRoute);

// localePath re-adds the /se/sv prefix, as the live-verified canonical
// fixtures below assume.
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

const mockCanAccess = vi.fn<(featureName: string) => boolean>(() => false);
vi.mock('../../../app/composables/useFeatureAccess', () => ({
  useFeatureAccess: () => ({ canAccess: mockCanAccess }),
}));

const stubs = {
  // Each stub renders the name off the product it was handed, so "which
  // component" and "with which product" are one assertion.
  ProductDetails: {
    template:
      '<div data-testid="page-ordinary" :data-alias="alias">{{ product?.name }}</div>',
    props: ['product', 'alias'],
  },
  ConfiguratorProduct: {
    template: '<div data-testid="page-configurator">{{ product?.name }}</div>',
    props: ['product'],
  },
  ProductDetailsSkeleton: { template: '<div data-testid="pdp-loading" />' },
  EmptyState: {
    template: '<div data-testid="pdp-error" />',
    props: ['icon', 'title', 'description', 'actionLabel', 'actionTo'],
  },
};

function makeProduct(overrides: Record<string, unknown> = {}): DetailProduct {
  return {
    productId: 1,
    name: 'Test Product',
    alias: 'test-product',
    canonicalUrl: '/se/sv/p/test-product',
    ...overrides,
  } as unknown as DetailProduct;
}

// The page awaits its fetch, so the setup is async: mount inside a Suspense
// boundary and flush before asserting.
async function mountPage(mountOptions: MountOptionsFor<Component> = {}) {
  const Wrapper = defineComponent({
    setup() {
      return () => h(Suspense, null, { default: () => h(ProductPage) });
    },
  });
  const wrapper = mountComponent(Wrapper, {
    ...mountOptions,
    global: { ...(mountOptions.global ?? {}), stubs },
  });
  await flushPromises();
  return wrapper;
}

function segmentsOf(path: string): string[] {
  return path.replace(/^\//, '').split('/');
}

/** The page reads both: the alias from the params, the path for the 301. */
async function setRoutePath(path: string): Promise<{ restore: () => void }> {
  const original = pdpRoute.path;
  pdpRoute.path = path;
  pdpRoute.params = { alias: segmentsOf(path) };
  return {
    restore: () => {
      pdpRoute.path = original;
      pdpRoute.params = { alias: segmentsOf(original) };
    },
  };
}

beforeEach(() => {
  mockProduct.value = makeProduct();
  mockStatus.value = 'success';
  mockError.value = null;
  mockCanAccess.mockReturnValue(false);
  navigateToMock.mockClear();
  recoverEntityUrlMock.mockClear();
  mockUseFetch.mockClear();
});

// ---------------------------------------------------------------------------
// Which component the product gets
// ---------------------------------------------------------------------------

describe('product page: the component a product type gets', () => {
  it('renders the configurator shell for a configurable product a buyer may configure', async () => {
    mockProduct.value = makeProduct({ configurable: true });
    mockCanAccess.mockReturnValue(true);

    const wrapper = await mountPage();

    expect(wrapper.find('[data-testid="page-configurator"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="page-ordinary"]').exists()).toBe(false);
  });

  it('renders the ordinary detail page when the access rule refuses the buyer', async () => {
    // Not a 404: the product exists, it is only the configurator that is not
    // offered on this tenant or to this buyer.
    mockProduct.value = makeProduct({ configurable: true });
    mockCanAccess.mockReturnValue(false);

    const wrapper = await mountPage();

    expect(wrapper.find('[data-testid="page-ordinary"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="page-configurator"]').exists()).toBe(
      false,
    );
  });

  it('renders the ordinary detail page for a product with no configurator behind it', async () => {
    mockCanAccess.mockReturnValue(true);

    const wrapper = await mountPage();

    expect(wrapper.find('[data-testid="page-ordinary"]').exists()).toBe(true);
  });

  it("hands the detail page the alias from the URL, not the loaded product's", async () => {
    // Under a locale fallback the default-language product answers at the
    // requested address, and every request the detail page builds has to keep
    // asking under that address.
    const { restore } = await setRoutePath('/se/en/p/wood-screw-se');
    mockProduct.value = makeProduct({ alias: 'wood-screw-sv' });

    try {
      const wrapper = await mountPage();

      expect(
        wrapper.find('[data-testid="page-ordinary"]').attributes('data-alias'),
      ).toBe('wood-screw-se');
    } finally {
      restore();
    }
  });

  it('follows the access rule when the buyer signs in, without a reload', async () => {
    // The rule reads the auth store, and the page reads the rule inside a
    // computed: a buyer who signs in on the page moves to the configurator.
    mockProduct.value = makeProduct({ configurable: true });
    const authenticated = ref(false);
    mockCanAccess.mockImplementation(() => authenticated.value);

    const wrapper = await mountPage();
    expect(wrapper.find('[data-testid="page-ordinary"]').exists()).toBe(true);

    authenticated.value = true;
    await nextTick();

    expect(wrapper.find('[data-testid="page-configurator"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="page-ordinary"]').exists()).toBe(false);
  });

  it('asks the access rule for the configurator feature', async () => {
    mockProduct.value = makeProduct({ configurable: true });

    await mountPage();

    expect(mockCanAccess).toHaveBeenCalledWith('configurator');
  });

  it('hands the loaded product to the page component', async () => {
    mockProduct.value = makeProduct({ name: 'Handed down' });

    const wrapper = await mountPage();

    expect(wrapper.find('[data-testid="page-ordinary"]').text()).toBe(
      'Handed down',
    );
  });

  it('loads the product exactly once', async () => {
    await mountPage();

    const urls = mockUseFetch.mock.calls.map(([urlOrFn]) =>
      typeof urlOrFn === 'function' ? urlOrFn() : urlOrFn,
    );
    expect(urls.filter((url) => url === '/api/products/test-product')).toEqual([
      '/api/products/test-product',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Content-miss recovery (Problem B) — moved from ProductDetails
// ---------------------------------------------------------------------------

describe('content-miss recovery (Problem B)', () => {
  it('calls recoverEntityUrl with the route path when the product is missing', async () => {
    // A renamed/old product slug must 301 to canonical via recoverEntityUrl
    // instead of throwing a bare 404. recoverEntityUrl is mocked to resolve,
    // so the setup continues; we only assert it was consulted with the path.
    const { restore } = await setRoutePath('/se/sv/p/old-slug');
    mockProduct.value = null;

    try {
      await mountPage();
      expect(recoverEntityUrlMock).toHaveBeenCalledTimes(1);
      expect(recoverEntityUrlMock).toHaveBeenCalledWith('/se/sv/p/old-slug');
    } finally {
      restore();
    }
  });

  it('calls recoverEntityUrl when the fetch errors', async () => {
    const { restore } = await setRoutePath('/se/sv/p/boom');
    mockProduct.value = null;
    mockError.value = new Error('fetch failed');

    try {
      await mountPage();
      expect(recoverEntityUrlMock).toHaveBeenCalledWith('/se/sv/p/boom');
    } finally {
      restore();
    }
  });

  it('does not call recoverEntityUrl when the product loads', async () => {
    // Route path must equal the normalized canonical so the canonical-correction
    // block is a genuine no-op (routable === path). Without this, samePrefix
    // returns true and the correction fires navigateTo as a side effect, meaning
    // the test no longer verifies "normal load = zero navigation".
    const { restore } = await setRoutePath('/se/sv/p/test-product');
    mockProduct.value = makeProduct({ canonicalUrl: '/se/sv/test-product' });

    try {
      await mountPage();

      expect(recoverEntityUrlMock).not.toHaveBeenCalled();
      expect(navigateToMock).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
// Canonical URL self-correction — moved from ProductDetails
// ---------------------------------------------------------------------------

describe('canonical URL self-correction (real 301)', () => {
  it('301s to the routable /p/ form when a prefix-less canonical differs', async () => {
    // Geins returns a canonicalUrl without our `/p/` product-route segment
    // (e.g. /se/sv/material/grenror/grenror-150-150-88). It must be a real
    // 301 to the routable /p/ path, not written raw (the raw form 404s on
    // refresh or in-app nav) and not a client-only history.replaceState.
    const { restore } = await setRoutePath('/se/sv/p/grenror-150-150-88');
    mockProduct.value = makeProduct({
      canonicalUrl: '/se/sv/material/grenror/grenror-150-150-88',
    });

    try {
      await mountPage();
      expect(navigateToMock).toHaveBeenCalledTimes(1);
      expect(navigateToMock).toHaveBeenCalledWith(
        '/se/sv/p/material/grenror/grenror-150-150-88',
        { redirectCode: 301, replace: true },
      );
    } finally {
      restore();
    }
  });

  it('301s to the routable /p/ form when canonicalUrl differs in the same prefix', async () => {
    const { restore } = await setRoutePath(
      '/se/sv/p/wood-screw-stainless-steel-10-mm-se',
    );
    mockProduct.value = makeProduct({
      canonicalUrl: '/se/sv/p/wood-screw-stainless-steel-10-mm-en',
    });

    try {
      await mountPage();
      expect(navigateToMock).toHaveBeenCalledTimes(1);
      expect(navigateToMock).toHaveBeenCalledWith(
        '/se/sv/p/wood-screw-stainless-steel-10-mm-en',
        { redirectCode: 301, replace: true },
      );
    } finally {
      restore();
    }
  });

  it('does not redirect when the routable target equals the route path (loop guard)', async () => {
    const { restore } = await setRoutePath('/se/sv/p/test-product');
    mockProduct.value = makeProduct({ canonicalUrl: '/se/sv/test-product' });

    try {
      await mountPage();
      expect(navigateToMock).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it('does not redirect when the canonical URL is in a different locale (cross-locale guard)', async () => {
    // Cross-locale: route is /se/en/... but canonical came back as /se/sv/...
    // because the locale fallback served default-language content. Redirecting
    // would yank the user out of EN, defeating their intent. samePrefix is
    // evaluated on the RAW canonical before normalizing, so this is a no-op.
    const { restore } = await setRoutePath(
      '/se/en/p/wood-screw-stainless-steel-10-mm-se',
    );
    mockProduct.value = makeProduct({
      canonicalUrl: '/se/sv/p/kategori-1/wood-screw-stainless-steel-10-mm-se',
    });

    try {
      await mountPage();
      expect(navigateToMock).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
// Loading and error, which came up with the fetch
// ---------------------------------------------------------------------------

describe('product page: loading and error', () => {
  it('renders the skeleton while the product is still loading', async () => {
    mockProduct.value = null;
    mockStatus.value = 'pending';

    const wrapper = await mountPage();

    expect(wrapper.find('[data-testid="pdp-loading"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="page-ordinary"]').exists()).toBe(false);
  });

  it('renders the error state when the load failed', async () => {
    mockProduct.value = null;
    mockError.value = new Error('fetch failed');

    const wrapper = await mountPage();

    expect(wrapper.find('[data-testid="pdp-error"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="page-ordinary"]').exists()).toBe(false);
  });
});
