import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from 'vitest';
import { nextTick, type Ref } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { mountComponent } from '../../utils/component';
import ConfiguratorProduct from '../../../app/components/pages/ConfiguratorProduct.vue';
import type { DetailProduct } from '../../../shared/types/commerce';
import type {
  CommittedConfiguration,
  Configuration,
  ConfigurationChange,
} from '../../../shared/types/configurator';
import {
  useConfiguratorSession,
  type ConfiguratorSessionError,
  type ConfiguratorSessionStatus,
} from '../../../app/composables/useConfiguratorSession';
import {
  makeInvalidConfiguration,
  makeValidConfiguration,
} from '../../fixtures/configurator';
import { CONFIGURATION_TAB_ID } from '../../../app/utils/product-tabs';

// ---------------------------------------------------------------------------
// The configurator page.
//
// The session is mocked, so what is under test is the wiring: which verb the
// page calls for which event, what it hands the form components, and which of
// its five faces is on screen. The session's own behaviour is covered by
// tests/unit/composables/useConfiguratorSession.test.ts.
//
// Components are registered without a path prefix (`pathPrefix: false`) and
// nothing registers them in this tier, so every component the template names is
// stubbed and one test asserts Vue resolved all of them — a misspelt name
// renders nothing and says so only as a runtime warning.
// ---------------------------------------------------------------------------

const CHANGE: ConfigurationChange = {
  type: 'option',
  optionId: 'top-steel',
  instanceId: 'top-steel',
  selected: true,
  quantity: 1,
  lock: 'none',
};

const COMMITTED: CommittedConfiguration = {
  committedConfigurationId: 'committed-1',
  configurationId: 'session-1',
  productId: '1101',
  quantity: 1,
  unitPrice: { net: 4100, currency: 'SEK' },
  summary: [
    { label: 'Steel top', value: '1', price: { net: 900, currency: 'SEK' } },
    { label: 'Width', value: '1400 mm' },
  ],
};

// The composable is built inside the factory, which cannot reach this file's
// scope; the test reaches it back by calling the mocked composable, which
// returns the one object every mount shares.
vi.mock('../../../app/composables/useConfiguratorSession', async () => {
  const { ref } = await vi.importActual<typeof import('vue')>('vue');
  const session = {
    configuration: ref<Configuration | null>(null),
    committed: ref<CommittedConfiguration | null>(null),
    status: ref<ConfiguratorSessionStatus>('idle'),
    busy: ref(false),
    error: ref<ConfiguratorSessionError | null>(null),
    expiresAt: ref<string | null>(null),
    remainingMs: ref(600_000),
    start: vi.fn(async () => {}),
    applyChanges: vi.fn(async () => {}),
    renew: vi.fn(async () => {}),
    commit: vi.fn(async () => {}),
    release: vi.fn(async () => {}),
  };
  return { useConfiguratorSession: () => session };
});

vi.mock('../../../app/composables/useLocaleMarket', () => ({
  useLocaleMarket: () => ({
    currentMarket: { value: 'se' },
    currentLocale: { value: 'sv' },
    localePath: (path: string) =>
      path.startsWith('/se/sv') ? path : `/se/sv${path}`,
    localeQuery: { value: {} },
    getCleanPath: () => '/',
    switchLocale: vi.fn(),
    switchMarket: vi.fn(),
  }),
}));

// The page asks for what every product page asks for: the related row and the
// PDP's CMS area. Both are answered empty here; the frame's own tests drive the
// tab row from the product instead.
const mockRelated = ref<unknown[] | null>(null);
const mockCmsArea = ref<{ containers: unknown[] } | null>(null);

const mockUseFetch = vi.fn((urlOrFn?: unknown) => {
  const url = typeof urlOrFn === 'function' ? urlOrFn() : urlOrFn;
  const data =
    typeof url === 'string' && url.includes('/related')
      ? mockRelated
      : typeof url === 'string' && url.includes('/api/cms/area')
        ? mockCmsArea
        : ref(null);
  return {
    data,
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

// useState (used by useLocaleAlternates) needs a live Nuxt instance the
// component tier does not provide; back it with a plain { value } box.
const { stubUseState } = vi.hoisted(() => ({
  stubUseState: (_key: string, init?: () => unknown) => ({
    value: typeof init === 'function' ? init() : undefined,
  }),
}));
vi.stubGlobal('useState', stubUseState);
vi.mock('#app/composables/state', () => ({ useState: stubUseState }));

// The head the page publishes is asserted in useProductSeo's own tier; here it
// only has to not need Nuxt.
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
// Mock the nuxt-schema-org runtime composable the auto-import resolves to.
// Resolve the path dynamically so the mock isn't tied to a pnpm store hash.
const { schemaOrgComposablePath } = vi.hoisted(() => {
  const nodeModule = require.resolve('nuxt-schema-org/schema');
  const pkgRoot = nodeModule.replace(/\/dist\/schema\..*$/, '');
  return {
    schemaOrgComposablePath: `${pkgRoot}/dist/runtime/app/composables/useSchemaOrg`,
  };
});
vi.mock(schemaOrgComposablePath, () => ({ useSchemaOrg: vi.fn() }));

vi.stubGlobal(
  'useRequestURL',
  () => new URL('https://example.test/se/sv/p/arbetsbord-pro'),
);

interface MockSession {
  configuration: Ref<Configuration | null>;
  committed: Ref<CommittedConfiguration | null>;
  status: Ref<ConfiguratorSessionStatus>;
  busy: Ref<boolean>;
  error: Ref<ConfiguratorSessionError | null>;
  remainingMs: Ref<number>;
  start: Mock;
  applyChanges: Mock;
  renew: Mock;
  commit: Mock;
  release: Mock;
}

const session = useConfiguratorSession() as unknown as MockSession;

const stubs = {
  AppBreadcrumbs: {
    // Real anchors: an item without an href must be distinguishable from one
    // with it, which is the whole point of the trail's assertions below.
    template: `<nav data-testid="crumbs"><a v-for="(item, index) in items"
      :key="index" :data-label="item.label" :href="item.href" /></nav>`,
    props: ['items'],
  },
  GeinsImage: {
    template: '<img data-testid="product-image" :alt="alt" :src="fileName" />',
    props: ['fileName', 'alt', 'type', 'loading', 'fit', 'aspectRatio'],
  },
  ProductGallery: {
    template: '<div data-testid="product-gallery" />',
    props: ['images', 'productName'],
  },
  ErrorBoundary: {
    template: '<div><slot /></div>',
    props: ['section'],
  },
  // vue-i18n is mocked at the tier, so its component is not registered either.
  'i18n-t': {
    template: '<p><slot name="tab" /></p>',
    props: ['keypath', 'tag'],
  },
  SharedErrorBoundary: {
    template: '<div><slot /></div>',
    props: ['section'],
  },
  ConfigurationHeader: {
    template: `<div data-testid="header" :data-status="status"
      :data-error="error ? 'yes' : 'no'">
      <button data-testid="header-renew" @click="$emit('renew')"></button>
      <button data-testid="header-restart" @click="$emit('restart')"></button>
    </div>`,
    props: ['configuration', 'status', 'busy', 'remainingMs', 'error'],
    emits: ['renew', 'restart'],
  },
  ConfiguratorSection: {
    template: `<section data-testid="section" :data-section-id="section.id"
      :data-disabled="String(disabled)">
      <button data-testid="section-change" @click="$emit('change', change)"></button>
    </section>`,
    props: ['section', 'level', 'disabled'],
    emits: ['change'],
    setup: () => ({ change: CHANGE }),
  },
  ConfiguratorCommitted: {
    template:
      '<div data-testid="committed" :data-lines="committed.summary.length" />',
    props: ['committed'],
  },
};

function makeProduct(overrides: Record<string, unknown> = {}): DetailProduct {
  return {
    productId: 1101,
    name: 'Arbetsbord Pro',
    alias: 'arbetsbord-pro',
    articleNumber: 'KONF-1001',
    productImages: [{ fileName: 'workbench.jpg', isPrimary: true, url: '' }],
    primaryCategory: {
      name: 'Arbetsplatsinredning',
      alias: 'arbetsplatsinredning',
      canonicalUrl: '/se/sv/c/inredning/arbetsplatsinredning',
    },
    ...overrides,
  } as unknown as DetailProduct;
}

function mountPage(product: DetailProduct = makeProduct()) {
  return mountComponent(ConfiguratorProduct, {
    props: { product, alias: product.alias ?? '' },
    global: { stubs },
  });
}

/** An active session holding a document — the state the form renders from. */
function activeWith(configuration: Configuration): void {
  session.configuration.value = configuration;
  session.status.value = 'active';
}

let warnings: string[] = [];
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  session.configuration.value = null;
  session.committed.value = null;
  session.status.value = 'idle';
  session.busy.value = false;
  session.error.value = null;
  for (const verb of [
    'start',
    'applyChanges',
    'renew',
    'commit',
    'release',
  ] as const) {
    session[verb].mockClear();
  }

  warnings = [];
  warnSpy = vi
    .spyOn(console, 'warn')
    .mockImplementation((...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    });
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe('ConfiguratorProduct', () => {
  it('renders the shared top card with the gallery', () => {
    const wrapper = mountPage();

    const card = wrapper.find('[data-testid="pdp-top-area"]');
    expect(card.exists()).toBe(true);
    expect(card.find('[data-testid="product-gallery"]').exists()).toBe(true);
  });

  it('names no component Vue cannot resolve', async () => {
    const wrapper = mountPage();
    activeWith(makeValidConfiguration());
    await nextTick();
    session.committed.value = COMMITTED;
    session.status.value = 'closed';
    await nextTick();

    expect(wrapper.find('[data-testid="committed"]').exists()).toBe(true);
    expect(
      warnings.filter((line) => line.includes('Failed to resolve component')),
    ).toEqual([]);
  });

  it('renders the heading and the article number', () => {
    const wrapper = mountPage();

    expect(wrapper.find('h1').text()).toBe('Arbetsbord Pro');
    expect(wrapper.text()).toContain('KONF-1001');
  });
});

describe('ConfiguratorProduct breadcrumbs', () => {
  function crumb(label: string, product?: DetailProduct) {
    return mountPage(product).find(`[data-label="${label}"]`);
  }

  it('links the primary category to its canonical category page', () => {
    // An item without an href is rendered as a link to the start page, which is
    // where this crumb went before.
    expect(crumb('Arbetsplatsinredning').attributes('href')).toBe(
      '/se/sv/c/inredning/arbetsplatsinredning',
    );
  });

  it('builds the category href from the alias when no canonical arrived', () => {
    const product = makeProduct({
      primaryCategory: { name: 'Bord', alias: 'bord', canonicalUrl: '' },
    });

    expect(crumb('Bord', product).attributes('href')).toBe('/se/sv/c/bord');
  });

  it('ends on the product, which is the page itself and carries no href', () => {
    expect(crumb('Arbetsbord Pro').attributes('href')).toBeUndefined();
  });
});

describe('ConfiguratorProduct session', () => {
  it('starts a session for the product on mount, as a string id', () => {
    mountPage();

    expect(session.start).toHaveBeenCalledWith('1101');
  });

  it('shows the starting state until a document arrives', () => {
    const wrapper = mountPage();

    expect(wrapper.find('[data-testid="configurator-loading"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="section"]').exists()).toBe(false);
  });

  it('reports a session that could not be created', async () => {
    const wrapper = mountPage();
    session.error.value = { status: 503, message: 'the request failed' };
    await nextTick();

    expect(wrapper.find('[data-testid="configurator-error"]').exists()).toBe(
      true,
    );
  });

  it('renders one section per root section of the document', async () => {
    const wrapper = mountPage();
    const document = makeValidConfiguration();
    activeWith(document);
    await nextTick();

    expect(
      wrapper
        .findAll('[data-testid="section"]')
        .map((section) => section.attributes('data-section-id')),
    ).toEqual(document.sections.map((section) => section.id));
  });

  it('sends a change from the form as a batch of one', async () => {
    const wrapper = mountPage();
    activeWith(makeValidConfiguration());
    await nextTick();

    await wrapper.find('[data-testid="section-change"]').trigger('click');

    expect(session.applyChanges).toHaveBeenCalledWith([CHANGE]);
  });

  it('locks the form while a batch is in flight', async () => {
    const wrapper = mountPage();
    activeWith(makeValidConfiguration());
    await nextTick();
    expect(
      wrapper.find('[data-testid="section"]').attributes('data-disabled'),
    ).toBe('false');

    session.busy.value = true;
    await nextTick();

    expect(
      wrapper
        .findAll('[data-testid="section"]')
        .every((section) => section.attributes('data-disabled') === 'true'),
    ).toBe(true);
  });

  it('renders the replaced document, not the one it started with', async () => {
    const wrapper = mountPage();
    activeWith(makeInvalidConfiguration({ sections: [] }));
    await nextTick();
    expect(wrapper.find('[data-testid="section"]').exists()).toBe(false);

    const replaced = makeValidConfiguration();
    session.configuration.value = replaced;
    await nextTick();

    expect(
      wrapper
        .findAll('[data-testid="section"]')
        .map((section) => section.attributes('data-section-id')),
    ).toEqual(replaced.sections.map((section) => section.id));
  });

  it('renews the session from the header', async () => {
    const wrapper = mountPage();
    activeWith(makeValidConfiguration());
    await nextTick();

    await wrapper.find('[data-testid="header-renew"]').trigger('click');

    expect(session.renew).toHaveBeenCalledTimes(1);
  });

  it('restarts an expired session in place, releasing it first', async () => {
    const wrapper = mountPage();
    session.configuration.value = makeValidConfiguration();
    session.status.value = 'expired';
    await nextTick();
    session.start.mockClear();

    await wrapper.find('[data-testid="header-restart"]').trigger('click');
    await nextTick();

    expect(session.release).toHaveBeenCalledTimes(1);
    expect(session.start).toHaveBeenCalledWith('1101');
  });

  it('shows no form and no commit button once the session has expired', async () => {
    const wrapper = mountPage();
    session.configuration.value = makeValidConfiguration();
    session.status.value = 'expired';
    await nextTick();

    expect(wrapper.find('[data-testid="section"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="configurator-commit"]').exists()).toBe(
      false,
    );
  });
});

describe('ConfiguratorProduct commit', () => {
  it('refuses a commit while the configuration is incomplete', async () => {
    const wrapper = mountPage();
    activeWith(makeInvalidConfiguration());
    await nextTick();

    expect(
      wrapper
        .find('[data-testid="configurator-commit"]')
        .attributes('disabled'),
    ).toBeDefined();
  });

  it('refuses a commit while a batch is in flight', async () => {
    const wrapper = mountPage();
    activeWith(makeValidConfiguration());
    session.busy.value = true;
    await nextTick();

    expect(
      wrapper
        .find('[data-testid="configurator-commit"]')
        .attributes('disabled'),
    ).toBeDefined();
  });

  it('commits a complete configuration', async () => {
    const wrapper = mountPage();
    activeWith(makeValidConfiguration());
    await nextTick();

    const button = wrapper.find('[data-testid="configurator-commit"]');
    expect(button.attributes('disabled')).toBeUndefined();
    await button.trigger('click');

    expect(session.commit).toHaveBeenCalledTimes(1);
  });

  it('replaces the form and the header with the committed summary', async () => {
    const wrapper = mountPage();
    activeWith(makeValidConfiguration());
    await nextTick();

    session.committed.value = COMMITTED;
    session.status.value = 'closed';
    await nextTick();

    const summary = wrapper.find('[data-testid="committed"]');
    expect(summary.exists()).toBe(true);
    expect(summary.attributes('data-lines')).toBe('2');
    expect(wrapper.find('[data-testid="section"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="configurator-commit"]').exists()).toBe(
      false,
    );
    // The summary carries the committed price; a header beside it would be a
    // second price for the same thing.
    expect(wrapper.find('[data-testid="header"]').exists()).toBe(false);
  });
});

describe('ConfiguratorProduct errors', () => {
  it('gives the header a failed renew, which is the failure its message names', async () => {
    const wrapper = mountPage();
    activeWith(makeValidConfiguration());
    await nextTick();

    await wrapper.find('[data-testid="header-renew"]').trigger('click');
    session.error.value = { status: 500, message: 'boom' };
    await nextTick();

    expect(
      wrapper.find('[data-testid="header"]').attributes('data-error'),
    ).toBe('yes');
    expect(
      wrapper.find('[data-testid="configurator-form-error"]').exists(),
    ).toBe(false);
  });

  it('keeps a failed change batch out of the header and reports it itself', async () => {
    const wrapper = mountPage();
    activeWith(makeValidConfiguration());
    await nextTick();

    await wrapper.find('[data-testid="section-change"]').trigger('click');
    session.error.value = { status: 500, message: 'boom' };
    await nextTick();

    expect(
      wrapper.find('[data-testid="header"]').attributes('data-error'),
    ).toBe('no');
    expect(
      wrapper.find('[data-testid="configurator-form-error"]').exists(),
    ).toBe(true);
  });
});

describe('ConfiguratorProduct frame', () => {
  // happy-dom has no layout, so the scroll the call to action performs is a
  // no-op that must still not throw.
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  function productWithTabContent(): DetailProduct {
    return makeProduct({
      texts: { text1: 'Lead', text2: 'Text 3 body', text3: 'Text 1 body' },
      parameterGroups: [
        {
          name: 'Mått',
          parameterGroupId: 1,
          parameters: [{ name: 'Bredd', value: '1400 mm', show: true }],
        },
      ],
    });
  }

  it('opens the row with the configuration tab, before the product tabs', () => {
    const triggers = mountPage(productWithTabContent()).findAll(
      '[data-testid^="configurator-tab-"]',
    );

    expect(triggers.map((t) => t.attributes('data-testid'))).toEqual([
      'configurator-tab-configuration',
      'configurator-tab-description',
      'configurator-tab-specifications',
      'configurator-tab-documents',
    ]);
  });

  it('leaves out the tabs the product has no content for', () => {
    const triggers = mountPage().findAll('[data-testid^="configurator-tab-"]');

    expect(triggers.map((t) => t.attributes('data-testid'))).toEqual([
      'configurator-tab-configuration',
      'configurator-tab-documents',
    ]);
  });

  it('carries the anchor the call to action scrolls to', () => {
    // The scroll itself is browser behaviour; what a test can hold is that the
    // element the handler looks up by id is the tab row.
    const wrapper = mountPage();

    expect(wrapper.find(`#${CONFIGURATION_TAB_ID}`).exists()).toBe(true);
    expect(
      wrapper.find(`#${CONFIGURATION_TAB_ID}`).attributes('data-testid'),
    ).toBe('product-tabs');
  });

  it('shows the configuration tab first', () => {
    const wrapper = mountPage(productWithTabContent());

    expect(
      wrapper
        .find('[data-testid="configurator-tab-configuration"]')
        .attributes('data-state'),
    ).toBe('active');
  });

  it('brings the buyer back to the configuration from another tab', async () => {
    const wrapper = mountPage(productWithTabContent());

    // reka-ui selects a tab on pointer down, not on click.
    await wrapper
      .find('[data-testid="configurator-tab-documents"]')
      .trigger('mousedown');
    expect(
      wrapper
        .find('[data-testid="configurator-tab-configuration"]')
        .attributes('data-state'),
    ).toBe('inactive');

    await wrapper.find('[data-testid="configurator-cta"]').trigger('click');

    expect(
      wrapper
        .find('[data-testid="configurator-tab-configuration"]')
        .attributes('data-state'),
    ).toBe('active');
  });

  it('offsets the scroll target by the sticky header', () => {
    // Without this the call to action scrolls the tab row under the header.
    const wrapper = mountPage();

    expect(wrapper.find(`#${CONFIGURATION_TAB_ID}`).classes()).toContain(
      'scroll-mt-44',
    );
  });

  it('keeps the form mounted while another tab is on screen', async () => {
    const wrapper = mountPage(productWithTabContent());
    activeWith(makeValidConfiguration());
    await nextTick();

    const before = wrapper.find('[data-testid="section"]').element;

    await wrapper
      .find('[data-testid="configurator-tab-documents"]')
      .trigger('mousedown');

    // Still the same element: the fields hold state the document does not
    // carry back, so a look at another tab must not remount them.
    const after = wrapper.find('[data-testid="section"]').element;
    expect(after).toBe(before);
  });

  it('restarts the session from the reset button in the tab heading', async () => {
    const wrapper = mountPage();

    await wrapper.find('[data-testid="configurator-reset"]').trigger('click');
    await flushPromises();

    expect(session.release).toHaveBeenCalled();
    expect(session.start).toHaveBeenCalledWith('1101');
  });

  it('offers the data sheet the ordinary product page offers, and nothing else', () => {
    const wrapper = mountPage();
    const printSpy = vi.fn();
    vi.stubGlobal('print', printSpy);

    const rows = wrapper.findAll('[data-testid="pdp-info-card"] button');
    expect(rows).toHaveLength(1);

    rows[0]!.trigger('click');
    expect(printSpy).toHaveBeenCalled();
  });

  it('renders the tenant CMS zone under the tabs', async () => {
    mockCmsArea.value = { containers: [{ id: 'pdp' }] };
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.find('[data-testid="pdp-cms-area"]').exists()).toBe(true);
    mockCmsArea.value = null;
  });
});
