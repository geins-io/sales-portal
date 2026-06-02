// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, defineComponent, h, Suspense, onErrorCaptured } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { defaultMountOptions } from '../../utils/component';
import {
  normalizeSlugToPath,
  stripLocaleMarketPrefix,
} from '../../../shared/utils/locale-market';

/**
 * Tests the key computation logic used by [...slug].vue to ensure
 * different routes produce different component keys.
 *
 * The catch-all page uses normalizedPath as the :key for the dynamic component.
 * This must produce unique keys for different category/subcategory navigations
 * so Vue properly re-renders the component (resetting pagination, filters, etc).
 */
describe('[...slug] page: component key uniqueness', () => {
  function computeKey(slug: string[]): string {
    return stripLocaleMarketPrefix(normalizeSlugToPath(slug));
  }

  it('produces different keys for parent vs subcategory', () => {
    const parentKey = computeKey(['se', 'sv', 'material']);
    const subKey = computeKey(['se', 'sv', 'material', 'epoxy']);

    expect(parentKey).toBe('/material');
    expect(subKey).toBe('/material/epoxy');
    expect(parentKey).not.toBe(subKey);
  });

  it('produces different keys for different categories of same type', () => {
    const key1 = computeKey(['se', 'sv', 'material']);
    const key2 = computeKey(['se', 'sv', 'clothing']);

    expect(key1).not.toBe(key2);
  });

  it('produces different keys for different slugs', () => {
    const key1 = computeKey(['se', 'sv', 'shoes']);
    const key2 = computeKey(['se', 'sv', 'nike']);

    expect(key1).not.toBe(key2);
  });

  it('strips locale/market prefix consistently', () => {
    const withPrefix = computeKey(['se', 'sv', 'material']);
    const withoutPrefix = computeKey(['material']);

    expect(withPrefix).toBe('/material');
    expect(withoutPrefix).toBe('/material');
  });

  it('handles single-segment paths', () => {
    const key = computeKey(['se', 'sv', 'about']);
    expect(key).toBe('/about');
  });

  it('handles root path', () => {
    const key = computeKey([]);
    expect(key).toBe('/');
  });
});

// ---------------------------------------------------------------------------
// Entity-URL fallback: CMS miss -> resolve-url -> 301 redirect, else 404.
// ---------------------------------------------------------------------------
//
// The catch-all is a page with a top-level `await useFetch`, so its setup is
// async and needs a Suspense parent to render. We mock the useFetch / navigateTo
// / useLocaleMarket / useRoute boundaries (mirroring the sibling page tests) and
// use the REAL route-helpers so we assert the actual prefixed targets.

// CMS page fetch result, overridden per test to simulate hit/miss.
const mockCmsData = ref<Record<string, unknown> | null>(null);
const mockCmsError = ref<unknown>(null);
// Resolver fetch result.
const mockResolveData = ref<Record<string, unknown> | null>(null);
const mockResolveError = ref<unknown>(null);

const mockUseFetch = vi.fn((...args: unknown[]) => {
  const url =
    typeof args[0] === 'function' ? (args[0] as () => string)() : args[0];
  if (typeof url === 'string' && url.includes('/api/resolve-url')) {
    return {
      data: mockResolveData,
      error: mockResolveError,
      status: ref('idle'),
      pending: ref(false),
      refresh: vi.fn(),
      execute: vi.fn(),
    };
  }
  // CMS page fetch (default).
  return {
    data: mockCmsData,
    error: mockCmsError,
    status: ref('idle'),
    pending: ref(false),
    refresh: vi.fn(),
    execute: vi.fn(),
  };
});

vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: unknown[]) => mockUseFetch(...args),
}));
vi.stubGlobal('useFetch', (...args: unknown[]) => mockUseFetch(...args));

const navigateToMock = vi.fn(() => Promise.resolve());
const createErrorMock = vi.fn((opts: unknown) => {
  const err = new Error('createError') as Error & { data?: unknown };
  err.data = opts;
  return err;
});

// localePath re-adds the /{market}/{locale}/ prefix to a locale-free path,
// matching the live-verified canonical fixtures.
const mockRoute = {
  path: '/se/sv/material/grenror',
  params: { slug: ['se', 'sv', 'material', 'grenror'] },
  query: {},
  hash: '',
  fullPath: '/se/sv/material/grenror',
  name: 'slug',
};
vi.stubGlobal('useRoute', () => mockRoute);

// navigateTo / useRoute / useRouter are auto-imported by the SFC from
// #app/composables/router; createError from #app/composables/error. Mock the
// modules (not just globalThis) so the page calls these test doubles.
vi.mock('#app/composables/router', () => ({
  useRoute: () => mockRoute,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    afterEach: vi.fn(),
  }),
  navigateTo: (...args: unknown[]) => navigateToMock(...args),
}));
vi.mock('#app/composables/error', () => ({
  createError: (opts: unknown) => {
    throw createErrorMock(opts);
  },
}));

vi.mock('../../../app/composables/useLocaleMarket', () => ({
  useLocaleMarket: () => ({
    currentMarket: { value: 'se' },
    currentLocale: { value: 'sv' },
    localePath: (path: string) =>
      `/se/sv${path.startsWith('/') ? path : '/' + path}`,
    localeQuery: { value: {} },
  }),
}));
vi.stubGlobal('useLocaleMarket', () => ({
  currentMarket: { value: 'se' },
  currentLocale: { value: 'sv' },
  localePath: (path: string) =>
    `/se/sv${path.startsWith('/') ? path : '/' + path}`,
  localeQuery: { value: {} },
}));

vi.stubGlobal(
  'useSeoLinks',
  vi.fn(() => ({ seoLinks: ref([]) })),
);
vi.stubGlobal('useSeoMeta', vi.fn());
vi.stubGlobal('useHead', vi.fn());
vi.stubGlobal(
  'useCmsMenu',
  vi.fn(() => ref(null)),
);
vi.mock('#app/composables/head', () => ({
  useHead: vi.fn(),
  useSeoMeta: vi.fn(),
}));

const stubs = {
  CmsWidgetArea: { template: '<div data-testid="cms-widget-area" />' },
  PageSidebarNav: { template: '<div data-testid="sidebar-nav" />' },
  ErrorBoundary: { template: '<div><slot /></div>' },
  Skeleton: { template: '<div data-testid="skeleton" />' },
  EmptyState: { template: '<div data-testid="route-error" />' },
};

// The first Suspense mount of the catch-all SFC compiles the page and its
// auto-imported children, which is slow under full-suite contention (the node
// tier runs non-isolated + concurrent). Give the mounting cases a generous
// budget so they do not flake on the default 5s timeout.
const MOUNT_TIMEOUT = 30000;

async function mountCatchAll() {
  const { default: SlugPage } =
    await import('../../../app/pages/[...slug].vue');
  const Wrapper = defineComponent({
    components: { SlugPage },
    setup() {
      // The 404 path throws createError from inside the page's async setup,
      // which rejects Suspense. Capture it here so the expected throw does not
      // surface as an unhandled rejection; the createErrorMock spy is what the
      // tests assert against.
      onErrorCaptured(() => false);
      return () => h(Suspense, null, { default: () => h(SlugPage) });
    },
  });
  const wrapper = mount(Wrapper, {
    ...defaultMountOptions,
    global: {
      ...defaultMountOptions.global,
      stubs: {
        ...(defaultMountOptions.global?.stubs ?? {}),
        ...stubs,
      },
    },
  });
  await flushPromises();
  return wrapper;
}

describe('[...slug] page: entity-url fallback', () => {
  beforeEach(() => {
    mockCmsData.value = null;
    mockCmsError.value = null;
    mockResolveData.value = null;
    mockResolveError.value = null;
    mockRoute.path = '/se/sv/material/grenror';
    mockRoute.params = { slug: ['se', 'sv', 'material', 'grenror'] };
    navigateToMock.mockClear();
    createErrorMock.mockClear();
    mockUseFetch.mockClear();
  });

  it(
    'redirects CMS miss to /c/ route when resolver returns a category',
    async () => {
      mockCmsData.value = null;
      mockResolveData.value = {
        type: 'category',
        canonicalUrl: '/se/sv/material/grenror',
      };

      await mountCatchAll();

      expect(navigateToMock).toHaveBeenCalledTimes(1);
      expect(navigateToMock).toHaveBeenCalledWith('/se/sv/c/material/grenror', {
        redirectCode: 301,
        replace: true,
      });
      expect(createErrorMock).not.toHaveBeenCalled();
    },
    MOUNT_TIMEOUT,
  );

  it(
    'redirects CMS miss to /p/ route when resolver returns a product',
    async () => {
      mockResolveData.value = {
        type: 'product',
        canonicalUrl: '/se/sv/material/grenror/grenror-150-150-88',
      };

      await mountCatchAll();

      expect(navigateToMock).toHaveBeenCalledWith(
        '/se/sv/p/material/grenror/grenror-150-150-88',
        { redirectCode: 301, replace: true },
      );
      expect(createErrorMock).not.toHaveBeenCalled();
    },
    MOUNT_TIMEOUT,
  );

  it(
    'navigates to the urlHistory redirect target on a renamed slug',
    async () => {
      mockResolveData.value = { redirect: '/se/sv/new-page-slug' };

      await mountCatchAll();

      expect(navigateToMock).toHaveBeenCalledWith('/se/sv/new-page-slug', {
        redirectCode: 301,
        replace: true,
      });
      expect(createErrorMock).not.toHaveBeenCalled();
    },
    MOUNT_TIMEOUT,
  );

  it(
    'throws 404 when both CMS and resolver miss',
    async () => {
      mockResolveData.value = null;
      mockResolveError.value = { statusCode: 404 };

      await mountCatchAll();

      expect(navigateToMock).not.toHaveBeenCalled();
      expect(createErrorMock).toHaveBeenCalledTimes(1);
      expect(createErrorMock.mock.calls[0]?.[0]).toMatchObject({
        statusCode: 404,
        fatal: true,
      });
    },
    MOUNT_TIMEOUT,
  );

  it(
    'does not call the resolver and renders when the CMS page exists',
    async () => {
      mockCmsData.value = {
        id: 1,
        containers: [{ name: 'main' }],
      };

      const wrapper = await mountCatchAll();

      const resolverCalled = mockUseFetch.mock.calls.some((call) => {
        const url =
          typeof call[0] === 'function' ? (call[0] as () => string)() : call[0];
        return typeof url === 'string' && url.includes('/api/resolve-url');
      });
      expect(resolverCalled).toBe(false);
      expect(navigateToMock).not.toHaveBeenCalled();
      expect(createErrorMock).not.toHaveBeenCalled();
      expect(wrapper.find('[data-testid="cms-widget-area"]').exists()).toBe(
        true,
      );
    },
    MOUNT_TIMEOUT,
  );

  it(
    'throws 404 (no loop) when the resolved target equals the current path',
    async () => {
      // The resolver echoes the current path back (defensive against a
      // self-referential history record).
      mockRoute.path = '/se/sv/new-page-slug';
      mockRoute.params = { slug: ['se', 'sv', 'new-page-slug'] };
      mockResolveData.value = { redirect: '/se/sv/new-page-slug' };

      await mountCatchAll();

      expect(navigateToMock).not.toHaveBeenCalled();
      expect(createErrorMock).toHaveBeenCalledTimes(1);
      expect(createErrorMock.mock.calls[0]?.[0]).toMatchObject({
        statusCode: 404,
      });
    },
    MOUNT_TIMEOUT,
  );
});
