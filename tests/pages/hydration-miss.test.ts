import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computed, defineComponent, h, type Component } from 'vue';
import { createError } from 'h3';
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime';
import ProductPage from '../../app/pages/p/[...alias].vue';
import CatchAllPage from '../../app/pages/[...slug].vue';
import ProductList from '../../app/components/pages/ProductList.vue';

// The tier-wide mock has no localeQuery, which the list page spreads.
vi.mock('../../app/composables/useLocaleMarket', () => ({
  useLocaleMarket: () => ({
    currentMarket: computed(() => 'se'),
    currentLocale: computed(() => 'en'),
    localePath: (path: string) =>
      `/se/en${path.startsWith('/') ? path : '/' + path}`,
    localeQuery: computed(() => ({})),
    validLocales: computed(() => new Set(['en'])),
    getCleanPath: () => '/',
    switchLocale: vi.fn(),
    switchMarket: vi.fn(),
  }),
}));

// A key the client computes differently from the server is not in the SSR
// payload. Hydrating with an empty payload forces that for every key at once,
// through Nuxt's own useFetch.
type Answer = 'content' | 404 | 502;
let answer: Answer = 'content';
const hits = { primary: vi.fn(), resolve: vi.fn() };

function primary<T>(content: T) {
  return () => {
    hits.primary();
    if (answer !== 'content') throw createError({ statusCode: answer });
    return content;
  };
}

registerEndpoint(
  '/api/products/test-product',
  primary({
    productId: 1,
    name: 'Test Product',
    alias: 'test-product',
    canonicalUrl: '/se/en/p/test-product',
  }),
);
registerEndpoint(
  '/api/product-lists/category/foder',
  primary({ id: 7, name: 'Foder', canonicalUrl: '/se/en/c/foder' }),
);
registerEndpoint(
  '/api/cms/page/om-oss',
  primary({ id: 'om-oss', containers: [{ widgets: [] }] }),
);
registerEndpoint('/api/resolve-url', () => {
  hits.resolve();
  return null;
});

/** A stub that shows the content it was handed, so "rendered" is observable. */
function shows(prop: string) {
  return defineComponent({
    props: [prop],
    setup: (props: Record<string, { name?: string } | undefined>) => () =>
      h('div', { 'data-testid': 'content' }, props[prop]?.name ?? ''),
  });
}

const stubs = {
  ProductDetails: shows('product'),
  ConfiguratorProduct: shows('product'),
  ProductDetailsSkeleton: true,
  ProductListHeader: shows('pageInfo'),
  CmsWidgetArea: defineComponent({
    setup: () => () => h('div', { 'data-testid': 'content' }, 'CMS'),
  }),
  PageSidebarNav: true,
};

interface Outcome {
  /** The first error that reached the error page, with the requests sent before it. */
  error: {
    statusCode?: number;
    fatal?: boolean;
    requestsBefore: number;
  } | null;
  primaryRequests: number;
  resolveRequests: number;
  content: string | null;
}

async function hydrateWithoutPayload(
  path: string,
  component: Component,
  props: Record<string, unknown> = {},
): Promise<Outcome> {
  await useRouter().replace(path);
  const nuxtApp = useNuxtApp();
  const was = {
    isHydrating: nuxtApp.isHydrating,
    serverRendered: nuxtApp.payload.serverRendered,
  };
  let error: Outcome['error'] = null;
  const off = nuxtApp.hook('vue:error', (err) => {
    error ??= {
      statusCode: (err as { statusCode?: number }).statusCode,
      fatal: (err as { fatal?: boolean }).fatal,
      requestsBefore:
        hits.primary.mock.calls.length + hits.resolve.mock.calls.length,
    };
  });
  nuxtApp.isHydrating = true;
  nuxtApp.payload.serverRendered = true;
  let content: string | null = null;
  try {
    const wrapper = await mountSuspended(component, {
      route: '',
      props,
      global: { stubs },
    }).catch(() => null);
    await runOut();
    const shown = wrapper?.find('[data-testid="content"]');
    content = shown?.exists() ? shown.text() : null;
  } finally {
    off();
    nuxtApp.isHydrating = was.isHydrating;
    nuxtApp.payload.serverRendered = was.serverRendered;
  }
  return {
    error,
    primaryRequests: hits.primary.mock.calls.length,
    resolveRequests: hits.resolve.mock.calls.length,
    content,
  };
}

/** Lets the deferred fetch, the resolver and the re-render run out. */
async function runOut() {
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
}

const pages = [
  {
    name: 'product page',
    path: '/p/test-product',
    component: ProductPage,
    props: {},
    content: 'Test Product',
    // ofetch retries a failed GET once unless the call sets `retry: 0`.
    attemptsOn502: 2,
  },
  {
    name: 'category page',
    path: '/c/foder',
    component: ProductList,
    props: { type: 'category', alias: 'foder' },
    content: 'Foder',
    attemptsOn502: 2,
  },
  {
    name: 'CMS page',
    path: '/om-oss',
    component: CatchAllPage,
    props: {},
    content: 'CMS',
    attemptsOn502: 1,
  },
];

describe.each(pages)('$name hydrating without its payload entry', (page) => {
  beforeEach(() => {
    answer = 'content';
    hits.primary.mockClear();
    hits.resolve.mockClear();
  });
  afterEach(() => {
    clearNuxtData();
    clearError();
  });

  const hydrate = () =>
    hydrateWithoutPayload(page.path, page.component, page.props);

  it('renders the content once the deferred read answers', async () => {
    expect(await hydrate()).toEqual({
      error: null,
      primaryRequests: 1,
      resolveRequests: 0,
      content: page.content,
    });
  });

  it('asks the resolver after the read answers 404, then shows a 404', async () => {
    answer = 404;
    expect(await hydrate()).toMatchObject({
      error: { statusCode: 404, fatal: true, requestsBefore: 2 },
      primaryRequests: 1,
      resolveRequests: 1,
    });
  });

  it('shows the error page with the status of a failed read', async () => {
    answer = 502;
    expect(await hydrate()).toMatchObject({
      error: {
        statusCode: 502,
        fatal: true,
        requestsBefore: page.attemptsOn502,
      },
      primaryRequests: page.attemptsOn502,
      resolveRequests: 0,
    });
  });
});
