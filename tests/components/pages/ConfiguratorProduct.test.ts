import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from 'vitest';
import { nextTick, ref, type Ref } from 'vue';
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
  makeCabinetConfiguration,
  makeInvalidConfiguration,
  makeSectionTreeConfiguration,
  makeValidConfiguration,
} from '../../fixtures/configurator';
import { CONFIGURATION_TAB_ID } from '../../../app/utils/product-tabs';
import type { BlockingItem } from '../../../app/utils/configurator-panel';

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

/** What a single-choice switch sends: the current row out first. */
const SWITCH: ConfigurationChange[] = [
  { ...CHANGE, optionId: 'top-laminate', selected: false },
  CHANGE,
];

const COMMITTED: CommittedConfiguration = {
  committedConfigurationId: 'committed-1',
  configurationId: 'session-1',
  articleNumber: '1101',
  quantity: 1,
  unitPrice: { sellingPriceExVat: 4100, currency: { code: 'SEK' } },
  discountPercent: 0,
  summary: [
    {
      label: 'Steel top',
      value: '1',
      price: { sellingPriceExVat: 900, currency: { code: 'SEK' } },
    },
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
    notReopened: ref(false),
    notReplayed: ref(false),
    notRestored: ref(false),
    editing: ref<{ cartId: string; itemId: string } | null>(null),
    editNotice: ref<'not_reopenable' | 'line_gone' | null>(null),
    status: ref<ConfiguratorSessionStatus>('idle'),
    busy: ref(false),
    error: ref<ConfiguratorSessionError | null>(null),
    start: vi.fn(async () => {}),
    edit: vi.fn(async () => {}),
    replay: vi.fn(async () => {}),
    restore: vi.fn(async () => {}),
    reopenLine: vi.fn(async () => {}),
    revertEdit: vi.fn(async () => {}),
    cancelEdit: vi.fn(async () => {}),
    applyChanges: vi.fn(async () => {}),
    commit: vi.fn(async () => {}),
    retryAdd: vi.fn(async () => {}),
    release: vi.fn(async () => {}),
    /** What the page passed in, so its add can be called directly. */
    options: null as unknown,
  };
  return {
    useConfiguratorSession: (options: unknown) => {
      session.options = options;
      return session;
    },
  };
});

const cartStore = vi.hoisted(() => ({
  cartId: null as string | null,
  isOpen: false,
  addConfiguredItem: vi.fn(
    async (): Promise<{ cartId: string; itemId: string } | null> => null,
  ),
  replaceConfiguredItem: vi.fn(
    async (
      _committedId: string,
      line: { cartId: string; itemId: string },
    ): Promise<{ cartId: string; itemId: string }> => line,
  ),
}));
vi.mock('../../../app/stores/cart', () => ({
  useCartStore: () => cartStore,
}));

// The shared passthrough drops a count the key does not spell out; this one
// keeps it visible so the rail mark's spoken count can be read.
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${JSON.stringify(params)}` : key,
    locale: ref('en'),
  }),
}));

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
  notReopened: Ref<boolean>;
  notReplayed: Ref<boolean>;
  notRestored: Ref<boolean>;
  editing: Ref<{ cartId: string; itemId: string } | null>;
  editNotice: Ref<'not_reopenable' | 'line_gone' | null>;
  status: Ref<ConfiguratorSessionStatus>;
  busy: Ref<boolean>;
  error: Ref<ConfiguratorSessionError | null>;
  start: Mock;
  edit: Mock;
  replay: Mock;
  restore: Mock;
  reopenLine: Mock;
  revertEdit: Mock;
  cancelEdit: Mock;
  applyChanges: Mock;
  commit: Mock;
  retryAdd: Mock;
  release: Mock;
  options: {
    addLine: (
      committed: CommittedConfiguration,
    ) => Promise<{ cartId: string; itemId: string } | null>;
    replaceLine: (
      committed: CommittedConfiguration,
      line: { cartId: string; itemId: string },
    ) => Promise<{ cartId: string; itemId: string } | null>;
  };
}

const session = useConfiguratorSession({}) as unknown as MockSession;

/** The tier's router mock, whose current route the page reads its query from. */
const router = (
  globalThis as unknown as {
    useRouter: () => {
      replace: Mock;
      currentRoute: Ref<{ query: Record<string, unknown> }>;
    };
  }
).useRouter();
const route = router.currentRoute;

/** What the status stub hands the page when its missing item is clicked. */
const goToTarget = ref<BlockingItem | null>(null);

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
  ConfigurationPanel: {
    template: `<div data-testid="panel" :data-status="status"
      :data-article="articleNumber" :data-editing="String(editing)">
      <button data-testid="panel-restart" @click="$emit('restart')"></button>
      <div data-testid="panel-slot"><slot /></div>
    </div>`,
    props: [
      'configuration',
      'status',
      'busy',
      'productName',
      'articleNumber',
      'editing',
    ],
    emits: ['restart'],
  },
  ConfiguratorRequiredStatus: {
    template: `<div data-testid="required-status"
      :data-valid="String(configuration.isValid)">
      <button data-testid="required-go-to"
        @click="$emit('go-to', goToTarget)"></button>
    </div>`,
    props: ['configuration'],
    emits: ['go-to'],
    setup: () => ({ goToTarget }),
  },
  ConfigurationAction: {
    template: `<div data-testid="action" :data-incomplete="incomplete"
      :data-error="error ?? ''" :data-editing="String(editing)">
      <button data-testid="configurator-commit" :disabled="!canCommit"
        @click="$emit('submit')"></button>
      <button data-testid="action-revert" @click="$emit('revert')"></button>
      <button data-testid="action-cancel" @click="$emit('cancel')"></button>
    </div>`,
    props: ['canCommit', 'busy', 'incomplete', 'error', 'editing'],
    emits: ['submit', 'revert', 'cancel'],
  },
  ConfiguratorAddRetry: {
    template: `<div data-testid="add-retry" :data-message="message ?? ''"
      :data-can-retry="String(canRetry)" :data-retryable="String(retryable)">
      <button data-testid="add-retry-button" @click="$emit('retry')"></button>
    </div>`,
    props: ['message', 'canRetry', 'busy', 'retryable'],
    emits: ['retry'],
  },
  ConfiguratorSection: {
    template: `<section data-testid="section" :data-section-id="section.id"
      :data-disabled="String(disabled)"
      :data-refused="refused ? JSON.stringify(refused) : ''">
      <button data-testid="section-change" @click="$emit('change', change)"></button>
      <div v-for="group in section.optionGroups" :key="group.id"
        :data-group-id="group.id" />
      <div v-for="variable in section.variables" :key="variable.id"
        :data-variable-id="variable.id" />
    </section>`,
    props: ['section', 'disabled', 'refused'],
    emits: ['change'],
    setup: () => ({ change: SWITCH }),
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
    skus: [{ skuId: 5001 }],
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
  session.notReopened.value = false;
  session.notReplayed.value = false;
  session.notRestored.value = false;
  session.editing.value = null;
  session.editNotice.value = null;
  session.status.value = 'idle';
  session.busy.value = false;
  session.error.value = null;
  for (const verb of [
    'start',
    'edit',
    'replay',
    'restore',
    'reopenLine',
    'revertEdit',
    'cancelEdit',
    'applyChanges',
    'commit',
    'retryAdd',
    'release',
  ] as const) {
    session[verb].mockClear();
  }
  cartStore.addConfiguredItem.mockClear();
  cartStore.replaceConfiguredItem.mockClear();
  cartStore.cartId = null;
  cartStore.isOpen = false;
  route.value.query = {};
  router.replace.mockClear();

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

  it('shows a spinner and the loading copy while the session starts', () => {
    const wrapper = mountPage();

    const loading = wrapper.find('[data-testid="configurator-loading"]');
    expect(loading.find('.animate-spin').exists()).toBe(true);
    expect(loading.text()).toContain('configurator.starting');
  });

  // The configurator area starts below the fold on a laptop, so the loader in
  // it is off screen for its whole life; the top card is where the buyer is.
  it('spins the call to action while the configurator loads', () => {
    const wrapper = mountPage();

    const cta = wrapper.find('[data-testid="configurator-cta"]');
    expect(cta.find('.animate-spin').exists()).toBe(true);
    expect(cta.attributes('disabled')).toBeUndefined();
  });

  it('drops the loading state from the call to action once the form is there', async () => {
    const wrapper = mountPage();
    activeWith(makeValidConfiguration());
    await nextTick();

    expect(
      wrapper.find('[data-testid="configurator-cta"] .animate-spin').exists(),
    ).toBe(false);
  });

  it('puts the loader at the top of the area, not in its middle', () => {
    // Centred, it sat half the area's min height further down the page.
    const slot = mountPage().find('[data-testid="configurator-form-slot"]');

    expect(slot.classes()).not.toContain('items-center');
    expect(slot.classes()).not.toContain('justify-center');
  });

  // Without the rail the slot is the inner grid's first item, which is the
  // 254px rail column; the form then arrives in the wide one.
  it('keeps the loading area in the form column at the form height', () => {
    const slot = mountPage().find('[data-testid="configurator-form-slot"]');

    expect(slot.classes()).toContain('lg:col-start-2');
    expect(slot.classes()).toContain('lg:min-h-[calc(100vh-16rem)]');
    // Below lg the form has no min height, but the loader still needs room.
    expect(slot.classes()).toContain('min-h-64');
  });

  it('draws the form frame around the loader, so it is there before the form', () => {
    const slot = mountPage().find('[data-testid="configurator-form-slot"]');

    expect(slot.classes()).toEqual(
      expect.arrayContaining(['border-border', 'border-l', 'pl-6']),
    );
  });

  it('keeps a session that could not be created in the form column', async () => {
    const wrapper = mountPage();
    session.error.value = { status: 503, message: 'the request failed' };
    await nextTick();

    expect(
      wrapper.find('[data-testid="configurator-form-slot"]').classes(),
    ).toContain('lg:col-start-2');
  });

  it('places the form after the rail, not in a column of its own', async () => {
    const wrapper = mountPage();
    activeWith(makeSectionTreeConfiguration());
    await nextTick();

    const slot = wrapper.find('[data-testid="configurator-form-slot"]');
    expect(slot.classes()).not.toContain('lg:col-start-2');
    expect(slot.classes()).not.toContain('lg:col-span-2');
  });

  it('gives the committed summary both columns, with no rail and no aside beside it', async () => {
    const wrapper = mountPage();
    session.committed.value = COMMITTED;
    session.status.value = 'closed';
    await nextTick();

    expect(
      wrapper.find('[data-testid="configurator-form-slot"]').classes(),
    ).toContain('lg:col-span-2');
  });

  it('renders the specification card while loading, with nothing to act on yet', () => {
    const wrapper = mountPage();

    expect(wrapper.find('[data-slot="card"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="panel"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="action"]').exists()).toBe(false);
  });

  it('puts the action in the card once the form is there', async () => {
    const wrapper = mountPage();
    activeWith(makeValidConfiguration());
    await nextTick();

    expect(wrapper.find('[data-testid="action"]').exists()).toBe(true);
  });

  it("hands the action alone to the panel's slot: no countdown and no renew", async () => {
    // The panel places it between the price and the specification. The
    // session is renewed silently, so nothing about it is on screen.
    const wrapper = mountPage();
    activeWith(makeValidConfiguration());
    await nextTick();

    const slot = wrapper.find('[data-testid="panel-slot"]');
    expect(
      slot.findAll(':scope > *').map((el) => el.attributes('data-testid')),
    ).toEqual(['action']);
    expect(
      wrapper.find('[data-testid="configurator-panel-expiry"]').exists(),
    ).toBe(false);
  });

  it('makes the aside one sticky column that does not scroll as a whole', async () => {
    const wrapper = mountPage();
    activeWith(makeValidConfiguration());
    await nextTick();

    const aside = wrapper.find('[data-testid="configurator-aside"]');
    expect(aside.classes()).toEqual(
      expect.arrayContaining([
        'lg:sticky',
        'lg:top-48',
        'lg:flex',
        'lg:flex-col',
      ]),
    );
    expect(aside.classes()).not.toContain('lg:overflow-y-auto');
    expect(aside.classes().some((c) => c.startsWith('lg:max-h-'))).toBe(false);
    // The card fills the column and lets the specification shrink inside it.
    expect(wrapper.find('[data-slot="card"]').classes()).toEqual(
      expect.arrayContaining(['min-h-0', 'lg:flex-1']),
    );
  });

  it('renders no card beside a session that could not be created', async () => {
    // The panel would be a header over nothing: there is no document coming.
    const wrapper = mountPage();
    session.error.value = { status: 503, message: 'the request failed' };
    await nextTick();

    expect(wrapper.find('[data-slot="card"]').exists()).toBe(false);
  });

  it('renders the card once a document arrives', async () => {
    const wrapper = mountPage();
    activeWith(makeValidConfiguration());
    await nextTick();

    expect(wrapper.find('[data-slot="card"]').exists()).toBe(true);
  });

  it('renders the card for an expired session, which the panel reports', async () => {
    const wrapper = mountPage();
    activeWith(makeValidConfiguration());
    await nextTick();
    session.status.value = 'expired';
    await nextTick();

    expect(wrapper.find('[data-testid="panel"]').exists()).toBe(true);
  });

  it('reports a session that could not be created', async () => {
    const wrapper = mountPage();
    session.error.value = { status: 503, message: 'the request failed' };
    await nextTick();

    expect(wrapper.find('[data-testid="configurator-error"]').exists()).toBe(
      true,
    );
  });

  it('asks a buyer the provider refused for want of a company account to sign in', async () => {
    const wrapper = mountPage();
    session.error.value = { status: 403, message: 'forbidden' };
    await nextTick();

    const error = wrapper.find('[data-testid="configurator-error"]');
    expect(error.text()).toContain('configurator.sign_in_required');
    expect(error.text()).not.toContain('configurator.failed');
  });

  it('keeps the general copy for any other failure to start', async () => {
    const wrapper = mountPage();
    session.error.value = { status: 502, message: 'unreachable' };
    await nextTick();

    expect(wrapper.find('[data-testid="configurator-error"]').text()).toContain(
      'configurator.failed',
    );
  });

  it('renders one section at a time, starting on the first of the rail', async () => {
    const wrapper = mountPage();
    activeWith(makeSectionTreeConfiguration());
    await nextTick();

    expect(
      wrapper
        .findAll('[data-testid="section"]')
        .map((section) => section.attributes('data-section-id')),
    ).toEqual(['frame']);
  });

  it('sends what the form emits as one batch, in its order', async () => {
    const wrapper = mountPage();
    activeWith(makeValidConfiguration());
    await nextTick();

    await wrapper.find('[data-testid="section-change"]').trigger('click');

    expect(session.applyChanges).toHaveBeenCalledTimes(1);
    expect(session.applyChanges).toHaveBeenCalledWith(SWITCH);
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

  it("brings the buyer's last choices back on a restart after expiry, rather than the defaults", async () => {
    const wrapper = mountPage();
    session.configuration.value = makeValidConfiguration();
    session.status.value = 'expired';
    await nextTick();
    session.start.mockClear();

    await wrapper.find('[data-testid="panel-restart"]').trigger('click');
    await flushPromises();

    expect(session.release).toHaveBeenCalledTimes(1);
    expect(session.restore).toHaveBeenCalledWith('1101');
    expect(session.start).not.toHaveBeenCalled();
    expect(session.reopenLine).not.toHaveBeenCalled();
    expect(session.replay).not.toHaveBeenCalled();
  });

  it('drops a stale order link on a restart, as the reset does', async () => {
    route.value.query = { order: 'not-a-guid', row: '1', keep: 'x' };
    const wrapper = mountPage();
    await flushPromises();
    session.configuration.value = makeValidConfiguration();
    session.status.value = 'expired';
    await nextTick();
    router.replace.mockClear();
    route.value.query = { order: 'not-a-guid', row: '1', keep: 'x' };

    await wrapper.find('[data-testid="panel-restart"]').trigger('click');
    await flushPromises();
    activeWith(makeValidConfiguration());
    await nextTick();

    expect(router.replace).toHaveBeenCalledWith({ query: { keep: 'x' } });
    expect(
      wrapper.find('[data-testid="configurator-not-replayed"]').exists(),
    ).toBe(false);
  });

  it('shows no form, no action and no countdown once the session has expired', async () => {
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

  it('tells the action the configuration is incomplete', async () => {
    const wrapper = mountPage();
    activeWith(makeInvalidConfiguration());
    await nextTick();

    expect(
      wrapper.find('[data-testid="action"]').attributes('data-incomplete'),
    ).toBe('true');
  });

  it('tells the action nothing is missing once the document is valid', async () => {
    const wrapper = mountPage();
    activeWith(makeValidConfiguration());
    session.busy.value = true;
    await nextTick();

    // In flight is not incomplete: the action keeps the finish label.
    expect(
      wrapper.find('[data-testid="action"]').attributes('data-incomplete'),
    ).toBe('false');
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
    // The summary carries the committed price; a panel beside it would be a
    // second price for the same thing.
    expect(wrapper.find('[data-testid="panel"]').exists()).toBe(false);
  });
});

describe('ConfiguratorProduct add to cart', () => {
  function committedWith(
    over: { error?: ConfiguratorSessionError | null } = {},
  ): void {
    session.committed.value = COMMITTED;
    session.status.value = 'closed';
    session.error.value = over.error ?? null;
  }

  it("adds the committed record as the product's one SKU, at the committed quantity, and hands back the line", async () => {
    mountPage(makeProduct({ skus: [{ skuId: 1652 }] }));
    const line = { cartId: 'cart-1', itemId: 'item-1' };
    cartStore.addConfiguredItem.mockResolvedValueOnce(line);

    await expect(
      session.options.addLine({ ...COMMITTED, quantity: 3 }),
    ).resolves.toEqual(line);

    expect(cartStore.addConfiguredItem).toHaveBeenCalledWith(
      'committed-1',
      1652,
      3,
    );
  });

  it.each([
    ['no SKU', []],
    ['more than one SKU', [{ skuId: 1 }, { skuId: 2 }]],
  ])(
    'refuses the action and says so for a product with %s',
    async (_case, skus) => {
      const wrapper = mountPage(makeProduct({ skus }));
      activeWith(makeValidConfiguration());
      await nextTick();

      expect(
        wrapper
          .find('[data-testid="configurator-commit"]')
          .attributes('disabled'),
      ).toBeDefined();
      expect(
        wrapper.find('[data-testid="action"]').attributes('data-error'),
      ).toBe('configurator.failed');
    },
  );

  it('gives the action no reason when the product has its one SKU', async () => {
    const wrapper = mountPage();
    activeWith(makeValidConfiguration());
    await nextTick();

    expect(
      wrapper.find('[data-testid="action"]').attributes('data-error'),
    ).toBe('');
  });

  it('says at the top of the form that the choices did not come back, when they did not', async () => {
    const wrapper = mountPage();
    activeWith(makeValidConfiguration());
    session.notReopened.value = true;
    await nextTick();

    const notice = wrapper.find('[data-testid="configurator-not-reopened"]');
    expect(notice.text()).toBe('configurator.not_reopened');
    // Above the form, not somewhere below it.
    const slot = wrapper.find('[data-testid="configurator-form-slot"]');
    expect(slot.element.contains(notice.element)).toBe(true);
    expect(
      notice.element.compareDocumentPosition(
        wrapper.find('[data-testid="section"]').element,
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('says nothing of the kind when the line was reopened, or off the form', async () => {
    const wrapper = mountPage();
    activeWith(makeValidConfiguration());
    await nextTick();
    expect(
      wrapper.find('[data-testid="configurator-not-reopened"]').exists(),
    ).toBe(false);

    session.notReopened.value = true;
    session.configuration.value = null;
    session.status.value = 'closed';
    await nextTick();
    expect(
      wrapper.find('[data-testid="configurator-not-reopened"]').exists(),
    ).toBe(false);
  });

  it('shows the loading face and the right column, never the summary, while the session is reopened', async () => {
    const wrapper = mountPage();
    activeWith(makeValidConfiguration());
    await nextTick();

    // What the session holds between a successful add and the reopen's answer.
    session.configuration.value = null;
    session.status.value = 'closed';
    session.busy.value = true;
    await nextTick();

    expect(wrapper.find('[data-testid="configurator-loading"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="configurator-aside"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="committed"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="add-retry"]').exists()).toBe(false);
  });

  it.each([
    [409, 'CONFLICT', 'configurator.add_not_added'],
    [401, 'UNAUTHORIZED', 'configurator.sign_in_required'],
    [403, 'FORBIDDEN', 'configurator.add_failed'],
    [502, 'EXTERNAL_API_ERROR', 'configurator.add_failed'],
  ])(
    'says why a %i add failed above the committed summary and offers a retry',
    async (status, code, key) => {
      const wrapper = mountPage();
      committedWith({ error: { status, message: 'x', code } });
      await nextTick();

      const retry = wrapper.find('[data-testid="add-retry"]');
      expect(retry.attributes('data-message')).toBe(key);
      expect(retry.attributes('data-can-retry')).toBe('true');
      expect(wrapper.find('[data-testid="committed"]').exists()).toBe(true);
    },
  );

  it('retries the add, and keeps the retry on screen while it runs', async () => {
    const wrapper = mountPage();
    committedWith({ error: { status: 502, message: 'x' } });
    await nextTick();

    await wrapper.find('[data-testid="add-retry-button"]').trigger('click');
    expect(session.retryAdd).toHaveBeenCalledTimes(1);
    expect(session.commit).not.toHaveBeenCalled();

    // What the session does while the retry is in flight.
    session.error.value = null;
    session.busy.value = true;
    await nextTick();

    const retry = wrapper.find('[data-testid="add-retry"]');
    expect(retry.exists()).toBe(true);
    expect(retry.attributes('data-message')).toBe('');
    expect(retry.attributes('data-can-retry')).toBe('false');
  });
});

describe('ConfiguratorProduct errors', () => {
  it('reports a failed change batch itself', async () => {
    const wrapper = mountPage();
    activeWith(makeValidConfiguration());
    await nextTick();

    await wrapper.find('[data-testid="section-change"]').trigger('click');
    session.error.value = { status: 500, message: 'boom' };
    await nextTick();

    expect(
      wrapper.find('[data-testid="configurator-form-error"]').exists(),
    ).toBe(true);
  });

  it('asks for a company account on the form too', async () => {
    const wrapper = mountPage();
    activeWith(makeValidConfiguration());
    await nextTick();

    await wrapper.find('[data-testid="section-change"]').trigger('click');
    session.error.value = { status: 403, message: 'forbidden' };
    await nextTick();

    expect(
      wrapper.find('[data-testid="configurator-form-error"]').text(),
    ).toContain('configurator.sign_in_required');
  });

  const REFUSAL = { status: 422, message: 'x', code: 'VALIDATION_ERROR' };

  // A switch is two changes in one group; the pick names the node to mark.
  it('hands the last change of a refused batch to the form and reports no failure above it', async () => {
    const wrapper = mountPage();
    activeWith(makeValidConfiguration());
    await nextTick();

    await wrapper.find('[data-testid="section-change"]').trigger('click');
    session.error.value = REFUSAL;
    await nextTick();

    expect(
      JSON.parse(
        wrapper.find('[data-testid="section"]').attributes('data-refused')!,
      ),
    ).toEqual(CHANGE);
    expect(
      wrapper.find('[data-testid="configurator-form-error"]').exists(),
    ).toBe(false);
  });

  it('keeps the general copy for a change that failed for another reason', async () => {
    const wrapper = mountPage();
    activeWith(makeValidConfiguration());
    await nextTick();

    await wrapper.find('[data-testid="section-change"]').trigger('click');
    session.error.value = { status: 502, message: 'bad gateway' };
    await nextTick();

    expect(
      wrapper.find('[data-testid="section"]').attributes('data-refused'),
    ).toBe('');
    expect(
      wrapper.find('[data-testid="configurator-form-error"]').text(),
    ).toContain('configurator.failed');
  });

  it('drops the refusal once the next batch clears the failure', async () => {
    const wrapper = mountPage();
    activeWith(makeValidConfiguration());
    await nextTick();
    await wrapper.find('[data-testid="section-change"]').trigger('click');
    session.error.value = REFUSAL;
    await nextTick();

    // What `run()` does as the next batch goes out.
    await wrapper.find('[data-testid="section-change"]').trigger('click');
    session.error.value = null;
    await nextTick();

    expect(
      wrapper.find('[data-testid="section"]').attributes('data-refused'),
    ).toBe('');
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

describe('ConfiguratorProduct sections rail', () => {
  const railIds = (
    wrapper: ReturnType<typeof mountPage>,
  ): (string | undefined)[] =>
    wrapper
      .findAll('[data-testid="configurator-rail-entry"]')
      .map((entry) => entry.attributes('data-section-id'));

  const activeSectionId = (
    wrapper: ReturnType<typeof mountPage>,
  ): string | undefined =>
    wrapper.find('[data-testid="section"]').attributes('data-section-id');

  async function mountTree() {
    const wrapper = mountPage();
    activeWith(makeSectionTreeConfiguration());
    await nextTick();
    return wrapper;
  }

  it('lists every visible section of the document, in document order', async () => {
    expect(railIds(await mountTree())).toEqual([
      'frame',
      'finish',
      'edge-trim',
      'cable-mgmt',
      'extras',
    ]);
  });

  it('puts the depth in the number rather than in an indent', async () => {
    const wrapper = await mountTree();

    const entries = wrapper.findAll('[data-testid="configurator-rail-entry"]');

    expect(entries.map((entry) => entry.attributes('data-number'))).toEqual([
      '1',
      '1.1',
      '1.1.1',
      '2',
      '3',
    ]);
    expect(
      wrapper
        .findAll('[data-testid="configurator-rail-number"]')
        .map((number) => number.text()),
    ).toEqual(['1', '1.1', '1.1.1', '2', '3']);
    // Nothing indents any more, at any depth: the number is the only thing
    // that says where an entry sits.
    expect(entries.map((entry) => entry.attributes('style'))).toEqual(
      entries.map(() => undefined),
    );
  });

  it('marks the active entry with a left border and nothing else moves', async () => {
    const wrapper = await mountTree();

    const entries = wrapper.findAll('[data-testid="configurator-rail-entry"]');

    expect(entries[0]!.classes()).toContain('border-primary');
    expect(entries[1]!.classes()).toContain('border-transparent');
    expect(entries[1]!.classes()).not.toContain('border-primary');
  });

  it('leaves out a hidden section and the visible child under it', async () => {
    const ids = railIds(await mountTree());

    expect(ids).not.toContain('warehouse');
    expect(ids).not.toContain('pallet-store');
  });

  it('marks the first entry when the document arrives', async () => {
    const wrapper = await mountTree();

    expect(
      wrapper
        .findAll('[data-testid="configurator-rail-entry"]')
        .filter((entry) => entry.attributes('data-active') === 'true')
        .map((entry) => entry.attributes('data-section-id')),
    ).toEqual(['frame']);
  });

  it('switches the body and moves the mark when an entry is clicked', async () => {
    const wrapper = await mountTree();

    await wrapper
      .findAll('[data-testid="configurator-rail-entry"]')[2]!
      .trigger('click');

    expect(activeSectionId(wrapper)).toBe('edge-trim');
    expect(
      wrapper
        .findAll('[data-testid="configurator-rail-entry"]')
        .filter((entry) => entry.attributes('data-active') === 'true')
        .map((entry) => entry.attributes('data-section-id')),
    ).toEqual(['edge-trim']);
  });

  it('reaches a nested section from the rail, not only a top-level one', async () => {
    const wrapper = await mountTree();

    await wrapper
      .findAll('[data-testid="configurator-rail-entry"]')[1]!
      .trigger('click');

    expect(activeSectionId(wrapper)).toBe('finish');
  });

  it('moves the mark with Next, as a click does', async () => {
    const wrapper = await mountTree();

    await wrapper.find('[data-testid="configurator-next"]').trigger('click');

    expect(activeSectionId(wrapper)).toBe('finish');
    expect(
      wrapper
        .findAll('[data-testid="configurator-rail-entry"]')
        .filter((entry) => entry.attributes('data-active') === 'true')
        .map((entry) => entry.attributes('data-section-id')),
    ).toEqual(['finish']);
  });

  it('steps back with Previous', async () => {
    const wrapper = await mountTree();

    await wrapper.find('[data-testid="configurator-next"]').trigger('click');
    await wrapper.find('[data-testid="configurator-prev"]').trigger('click');

    expect(activeSectionId(wrapper)).toBe('frame');
  });

  it('offers no step back from the first entry', async () => {
    const wrapper = await mountTree();

    expect(
      wrapper.find('[data-testid="configurator-prev"]').attributes('disabled'),
    ).toBeDefined();
  });

  it('offers no step forward from the last entry', async () => {
    const wrapper = await mountTree();

    await wrapper
      .findAll('[data-testid="configurator-rail-entry"]')[4]!
      .trigger('click');

    expect(
      wrapper.find('[data-testid="configurator-next"]').attributes('disabled'),
    ).toBeDefined();
  });

  it('never locks the step forward on a section being complete', async () => {
    const wrapper = await mountTree();

    // `finish` is the section with an outstanding choice, and the buyer walks
    // past it without making one.
    await wrapper.find('[data-testid="configurator-next"]').trigger('click');
    await wrapper.find('[data-testid="configurator-next"]').trigger('click');

    expect(activeSectionId(wrapper)).toBe('edge-trim');
  });

  it('marks the section with an outstanding choice and no other', async () => {
    const wrapper = await mountTree();

    expect(
      wrapper
        .findAll('[data-testid="configurator-rail-entry"]')
        .filter((entry) =>
          entry.find('[data-testid="configurator-rail-remaining"]').exists(),
        )
        .map((entry) => entry.attributes('data-section-id')),
    ).toEqual(['finish']);
  });

  it('marks the outstanding section with a dot that only a screen reader reads', async () => {
    const wrapper = await mountTree();
    const finish = wrapper
      .findAll('[data-testid="configurator-rail-entry"]')
      .find((entry) => entry.attributes('data-section-id') === 'finish')!;
    const dot = finish.find('[data-testid="configurator-rail-remaining"]');

    expect(dot.attributes('role')).toBe('img');
    expect(dot.attributes('aria-label')).toBe(
      'configurator.remaining_required {"count":1}',
    );
    expect(dot.text()).toBe('');
    expect(finish.text()).not.toContain('configurator.remaining');
  });

  it('drops the mark once the document says the choice was made', async () => {
    const wrapper = await mountTree();
    const answered = makeSectionTreeConfiguration();
    const colour = answered.sections[0]!.sections[0]!.optionGroups.find(
      (group) => group.id === 'color',
    )!;
    colour.options[0]!.selected = true;

    session.configuration.value = answered;
    await nextTick();

    expect(
      wrapper.findAll('[data-testid="configurator-rail-remaining"]'),
    ).toHaveLength(0);
  });

  it('renders a one-item rail and no pager for a document with a single visible section', async () => {
    // The cabinet seed carries two visible sections and one hidden one, so the
    // one-section shape is made here rather than taken from a seed: a layout
    // that switched on a count is the rule this replaced.
    const single = makeCabinetConfiguration();
    single.sections = single.sections.filter(
      (section) => section.id !== 'interior',
    );

    const wrapper = mountPage();
    activeWith(single);
    await nextTick();

    expect(railIds(wrapper)).toEqual(['cabinet']);
    expect(activeSectionId(wrapper)).toBe('cabinet');
    for (const id of [
      'configurator-prev',
      'configurator-position',
      'configurator-next',
    ]) {
      expect(wrapper.find(`[data-testid="${id}"]`).exists()).toBe(false);
    }
  });

  it('keeps the pager when there are two visible sections', async () => {
    const wrapper = mountPage();
    activeWith(makeCabinetConfiguration());
    await nextTick();

    expect(wrapper.find('[data-testid="configurator-position"]').text()).toBe(
      'configurator.section_position {"current":1,"total":2}',
    );
    expect(
      wrapper.find('[data-testid="configurator-prev"]').attributes('disabled'),
    ).toBeDefined();
    expect(
      wrapper.find('[data-testid="configurator-next"]').attributes('disabled'),
    ).toBeUndefined();
  });

  it('counts a visible nested section towards the pager', async () => {
    const nested = makeCabinetConfiguration();
    const [cabinet, interior] = nested.sections.filter(
      (section) => section.visible,
    );
    nested.sections = [{ ...cabinet!, sections: [interior!] }];

    const wrapper = mountPage();
    activeWith(nested);
    await nextTick();

    expect(railIds(wrapper)).toEqual(['cabinet', 'interior']);
    expect(wrapper.find('[data-testid="configurator-position"]').text()).toBe(
      'configurator.section_position {"current":1,"total":2}',
    );
  });

  it('renders no rail and no pager for a document with no visible section', async () => {
    const wrapper = mountPage();
    activeWith(makeValidConfiguration({ sections: [] }));
    await nextTick();

    expect(wrapper.find('[data-testid="configurator-rail"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="configurator-next"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="section"]').exists()).toBe(false);
  });

  it('keeps the buyer where they are when the replaced document still has the section', async () => {
    const wrapper = await mountTree();
    await wrapper
      .findAll('[data-testid="configurator-rail-entry"]')[3]!
      .trigger('click');

    session.configuration.value = makeSectionTreeConfiguration();
    await nextTick();

    expect(activeSectionId(wrapper)).toBe('cable-mgmt');
  });

  it('falls back to the section before it when the replaced document dropped it', async () => {
    const wrapper = await mountTree();
    // `cable-mgmt` is the fourth entry; `edge-trim` is the one above it.
    await wrapper
      .findAll('[data-testid="configurator-rail-entry"]')[3]!
      .trigger('click');

    const replaced = makeSectionTreeConfiguration();
    replaced.sections = replaced.sections.filter(
      (section) => section.id !== 'cable-mgmt',
    );
    session.configuration.value = replaced;
    await nextTick();

    expect(activeSectionId(wrapper)).toBe('edge-trim');
  });

  it('marks a section whose group the provider put an error on', async () => {
    const wrapper = await mountTree();
    const objected = makeSectionTreeConfiguration();
    // `extras` requires nothing and has no unmet choice, so a badge on it can
    // only have come from the message.
    const extras = objected.sections.find((s) => s.id === 'extras')!;
    extras.optionGroups[0]!.messages = [
      { severity: 'error', text: 'Not available with this frame.' },
    ];

    session.configuration.value = objected;
    await nextTick();

    expect(
      wrapper
        .findAll('[data-testid="configurator-rail-entry"]')
        .filter((entry) =>
          entry.find('[data-testid="configurator-rail-remaining"]').exists(),
        )
        .map((entry) => entry.attributes('data-section-id')),
    ).toEqual(['finish', 'extras']);
  });
});

// ---------------------------------------------------------------------------
// The section page: its trail, its number and the two shapes it takes when the
// section is a way in rather than a page of its own.
// ---------------------------------------------------------------------------

describe('ConfiguratorProduct section trail', () => {
  async function mountTree() {
    const wrapper = mountPage();
    activeWith(makeSectionTreeConfiguration());
    await nextTick();
    return wrapper;
  }

  const crumbNames = (wrapper: ReturnType<typeof mountPage>): string[] =>
    wrapper
      .findAll('[data-testid="configurator-crumb"]')
      .map((crumb) => crumb.text());

  it('writes no trail at the top level, where it would repeat the heading', async () => {
    const wrapper = await mountTree();

    expect(wrapper.find('[data-testid="configurator-crumbs"]').exists()).toBe(
      false,
    );
  });

  it('names the ancestors of a nested section, itself last', async () => {
    const wrapper = await mountTree();

    await wrapper
      .findAll('[data-testid="configurator-rail-entry"]')[2]!
      .trigger('click');

    expect(crumbNames(wrapper)).toEqual(['Frame', 'Finish', 'Edge trim']);
  });

  it('opens the ancestor the buyer clicks in the trail', async () => {
    const wrapper = await mountTree();

    await wrapper
      .findAll('[data-testid="configurator-rail-entry"]')[2]!
      .trigger('click');
    await wrapper
      .findAll('[data-testid="configurator-crumb"]')[0]!
      .trigger('click');

    expect(
      wrapper.find('[data-testid="section"]').attributes('data-section-id'),
    ).toBe('frame');
  });

  it('numbers the header with the section\u2019s place in the tree', async () => {
    const wrapper = await mountTree();

    await wrapper
      .findAll('[data-testid="configurator-rail-entry"]')[2]!
      .trigger('click');

    expect(
      wrapper.find('[data-testid="configurator-section-number"]').text(),
    ).toBe('1.1.1');
  });

  it('draws no number before the title of a single visible section, and keeps it in the rail', async () => {
    const single = makeCabinetConfiguration();
    single.sections = single.sections.filter(
      (section) => section.id !== 'interior',
    );

    const wrapper = mountPage();
    activeWith(single);
    await nextTick();

    expect(
      wrapper.find('[data-testid="configurator-section-number"]').exists(),
    ).toBe(false);
    expect(
      wrapper.find('[data-testid="configurator-rail-number"]').text(),
    ).toBe('1');
  });

  it('numbers the title when there are two visible sections', async () => {
    const wrapper = mountPage();
    activeWith(makeCabinetConfiguration());
    await nextTick();

    expect(
      wrapper.find('[data-testid="configurator-section-number"]').text(),
    ).toBe('1');
  });

  it('keeps the position line a flat count of the rail', async () => {
    const wrapper = await mountTree();

    await wrapper
      .findAll('[data-testid="configurator-rail-entry"]')[2]!
      .trigger('click');

    // Where the buyer stands in the walk, not where the section sits in the
    // tree; the number in the header already says the second thing.
    expect(wrapper.find('[data-testid="configurator-position"]').text()).toBe(
      'configurator.section_position {"current":3,"total":5}',
    );
  });
});

describe('ConfiguratorProduct subsection menu', () => {
  /** `Frame` gains a second child, and keeps its own groups and fields. */
  function withTwoChildren(): Configuration {
    const config = makeSectionTreeConfiguration();
    const frame = config.sections[0]!;
    frame.sections = [
      ...frame.sections,
      {
        id: 'castors',
        name: 'Castors',
        description: '',
        visible: true,
        sections: [],
        variables: [],
        optionGroups: [],
        messages: [],
      },
    ];
    return config;
  }

  /** `Frame` with nothing of its own, so its children are all it offers. */
  function emptied(config: Configuration): Configuration {
    const frame = config.sections[0]!;
    frame.optionGroups = [];
    frame.variables = [];
    return config;
  }

  async function mountWith(config: Configuration) {
    const wrapper = mountPage();
    activeWith(config);
    await nextTick();
    return wrapper;
  }

  const subsectionIds = (
    wrapper: ReturnType<typeof mountPage>,
  ): (string | undefined)[] =>
    wrapper
      .findAll('[data-testid="configurator-subsection"]')
      .map((button) => button.attributes('data-section-id'));

  it('offers both children of a section with nothing of its own', async () => {
    const wrapper = await mountWith(emptied(withTwoChildren()));

    expect(subsectionIds(wrapper)).toEqual(['finish', 'castors']);
    expect(wrapper.find('[data-testid="section"]').exists()).toBe(false);
  });

  it('offers the one child of a section with nothing of its own', async () => {
    const wrapper = await mountWith(emptied(makeSectionTreeConfiguration()));

    // One entry is still a menu: a heading over an empty column is no page.
    expect(subsectionIds(wrapper)).toEqual(['finish']);
    expect(wrapper.find('[data-testid="section"]').exists()).toBe(false);
  });

  it('renders the content of a section with two children and choices of its own', async () => {
    const wrapper = await mountWith(withTwoChildren());

    expect(
      wrapper.find('[data-testid="section"]').attributes('data-section-id'),
    ).toBe('frame');
    expect(subsectionIds(wrapper)).toEqual([]);
  });

  it('renders the content of a section with one child and choices of its own', async () => {
    const wrapper = await mountWith(makeSectionTreeConfiguration());

    expect(
      wrapper.find('[data-testid="section"]').attributes('data-section-id'),
    ).toBe('frame');
    expect(subsectionIds(wrapper)).toEqual([]);
  });

  it('offers the children of a section whose only fields are unavailable', async () => {
    const config = makeSectionTreeConfiguration();
    const frame = config.sections[0]!;
    frame.optionGroups = [];
    for (const variable of frame.variables) variable.available = false;

    const wrapper = await mountWith(config);

    // The fields are hidden, so the page would otherwise be an empty column.
    expect(frame.variables.length).toBeGreaterThan(0);
    expect(subsectionIds(wrapper)).toEqual(['finish']);
    expect(wrapper.find('[data-testid="section"]').exists()).toBe(false);
  });

  it('counts a message as no content, and still shows it over the menu', async () => {
    const config = emptied(makeSectionTreeConfiguration());
    config.sections[0]!.messages = [
      { severity: 'warning', text: 'Castors are fitted at the factory.' },
    ];

    const wrapper = await mountWith(config);

    expect(subsectionIds(wrapper)).toEqual(['finish']);
    expect(wrapper.find('[data-testid="configurator-message"]').text()).toBe(
      'Castors are fitted at the factory.',
    );
  });

  it('opens the child the buyer picks', async () => {
    const wrapper = await mountWith(emptied(withTwoChildren()));

    await wrapper
      .findAll('[data-testid="configurator-subsection"]')[1]!
      .trigger('click');

    expect(
      wrapper.find('[data-testid="section"]').attributes('data-section-id'),
    ).toBe('castors');
  });

  it('leaves out a hidden child, which the rail leaves out too', async () => {
    const config = emptied(withTwoChildren());
    const frame = config.sections[0]!;
    frame.sections = [
      ...frame.sections,
      {
        id: 'warehouse-prep',
        name: 'Warehouse prep',
        description: '',
        visible: false,
        sections: [],
        variables: [],
        optionGroups: [],
        messages: [],
      },
    ];

    expect(subsectionIds(await mountWith(config))).toEqual([
      'finish',
      'castors',
    ]);
  });

  it('is no menu when every child is hidden', async () => {
    const config = emptied(makeSectionTreeConfiguration());
    config.sections[0]!.sections[0]!.visible = false;

    const wrapper = await mountWith(config);

    expect(subsectionIds(wrapper)).toEqual([]);
    expect(
      wrapper.find('[data-testid="section"]').attributes('data-section-id'),
    ).toBe('frame');
  });
});

describe('ConfiguratorProduct sticky box height', () => {
  let rectSpy: ReturnType<typeof vi.spyOn>;
  const size = { width: window.innerWidth, height: window.innerHeight };

  function setViewport(width: number, height: number) {
    Object.defineProperty(window, 'innerWidth', {
      value: width,
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: height,
      configurable: true,
    });
    window.dispatchEvent(new Event('resize'));
  }

  beforeEach(() => {
    // Only the left column's bottom matters: it is what the box stops at.
    rectSpy = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: Element) {
        return this.matches('[data-testid="configurator-left"]')
          ? new DOMRect(0, 0, 900, 700)
          : new DOMRect(0, 0, 0, 0);
      });
  });

  afterEach(() => {
    rectSpy.mockRestore();
    setViewport(size.width, size.height);
  });

  async function mountForm() {
    const wrapper = mountPage();
    activeWith(makeValidConfiguration());
    await flushPromises();
    window.dispatchEvent(new Event('resize'));
    await flushPromises();
    return wrapper;
  }

  it('caps the box at the left column from lg up, below the sticky offset', async () => {
    setViewport(1440, 900);
    const wrapper = await mountForm();
    // The column ends at 700 before the viewport does at 884; less 192.
    expect(
      (
        wrapper.find('[data-testid="configurator-aside"]')
          .element as HTMLElement
      ).style.maxHeight,
    ).toBe('508px');
  });

  it('caps the box at the viewport when the column runs past it', async () => {
    setViewport(1440, 600);
    const wrapper = await mountForm();
    // 600 less the 16 px of air is 584; less 192.
    expect(
      (
        wrapper.find('[data-testid="configurator-aside"]')
          .element as HTMLElement
      ).style.maxHeight,
    ).toBe('392px');
  });

  it('sets no height below lg, where the box stacks under the form', async () => {
    setViewport(800, 900);
    const wrapper = await mountForm();
    expect(
      (
        wrapper.find('[data-testid="configurator-aside"]')
          .element as HTMLElement
      ).style.maxHeight,
    ).toBe('');
  });
});

describe('ConfiguratorProduct rail scroll', () => {
  // Entries 30 tall in a list that shows 60 of them: two at a time.
  const ENTRY = 30;
  const SHOWN = 60;
  let rectSpy: ReturnType<typeof vi.spyOn>;
  let windowScroll: Mock;
  let intoView: Mock;
  const originals = {
    scrollTo: window.scrollTo,
    scrollBy: window.scrollBy,
    scrollIntoView: Element.prototype.scrollIntoView,
  };

  beforeEach(() => {
    rectSpy = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: Element) {
        const list = this.closest('[data-testid="configurator-rail-list"]');
        if (!list || this === list) return new DOMRect(0, 0, 254, SHOWN);
        const index = [
          ...list.querySelectorAll('[data-testid="configurator-rail-entry"]'),
        ].indexOf(this);
        return new DOMRect(0, index * ENTRY - list.scrollTop, 254, ENTRY);
      });
    windowScroll = vi.fn();
    window.scrollTo = windowScroll as unknown as typeof window.scrollTo;
    window.scrollBy = windowScroll as unknown as typeof window.scrollBy;
    intoView = vi.fn();
    Element.prototype.scrollIntoView = intoView;
  });

  afterEach(() => {
    rectSpy.mockRestore();
    window.scrollTo = originals.scrollTo;
    window.scrollBy = originals.scrollBy;
    Element.prototype.scrollIntoView = originals.scrollIntoView;
  });

  async function mountList() {
    const wrapper = mountPage();
    activeWith(makeSectionTreeConfiguration());
    await nextTick();
    const list = wrapper.find('[data-testid="configurator-rail-list"]');
    Object.defineProperty(list.element, 'clientHeight', { value: SHOWN });
    return { wrapper, list: list.element as HTMLElement };
  }

  async function click(wrapper: ReturnType<typeof mountPage>, id: string) {
    await wrapper
      .find(`[data-testid="configurator-rail-entry"][data-section-id="${id}"]`)
      .trigger('click');
    await flushPromises();
  }

  it('caps the section list at lg and lets it scroll inside', async () => {
    const { list } = await mountList();
    expect(list.tagName).toBe('UL');
    expect([...list.classList]).toEqual(
      expect.arrayContaining(['lg:max-h-[30vh]', 'lg:overflow-y-auto']),
    );
    // Below lg the cap is not there: the classes carry the breakpoint.
    expect(list.classList.contains('max-h-[30vh]')).toBe(false);
    expect(list.classList.contains('overflow-y-auto')).toBe(false);
  });

  it('draws the focus ring inside each entry, where the list cannot clip it', async () => {
    const { wrapper } = await mountList();
    for (const entry of wrapper.findAll(
      '[data-testid="configurator-rail-entry"]',
    )) {
      expect(entry.classes()).toEqual(
        expect.arrayContaining([
          'focus-visible:outline-none',
          'focus-visible:ring-2',
          'focus-visible:ring-inset',
        ]),
      );
    }
  });

  it('scrolls the list to an active entry below what it shows', async () => {
    const { wrapper, list } = await mountList();
    await click(wrapper, 'edge-trim');
    // The third entry runs 60 to 90; the list shows 0 to 60.
    expect(list.scrollTop).toBe(30);
  });

  it('scrolls the list back up to an active entry above what it shows', async () => {
    const { wrapper, list } = await mountList();
    await click(wrapper, 'extras');
    expect(list.scrollTop).toBe(90);
    await click(wrapper, 'finish');
    expect(list.scrollTop).toBe(30);
  });

  it('leaves the list where it is when the active entry is in view', async () => {
    const { wrapper, list } = await mountList();
    await click(wrapper, 'finish');
    expect(list.scrollTop).toBe(0);
  });

  it('follows Next as it follows a click', async () => {
    const { wrapper, list } = await mountList();
    await wrapper.find('[data-testid="configurator-next"]').trigger('click');
    await wrapper.find('[data-testid="configurator-next"]').trigger('click');
    await flushPromises();
    expect(list.scrollTop).toBe(30);
  });

  it('scrolls neither the window nor any element into view', async () => {
    const { wrapper } = await mountList();
    await click(wrapper, 'extras');
    await wrapper.find('[data-testid="configurator-prev"]').trigger('click');
    await flushPromises();
    expect(windowScroll).not.toHaveBeenCalled();
    expect(intoView).not.toHaveBeenCalled();
  });
});

describe('ConfiguratorProduct required status', () => {
  async function formWith(configuration: Configuration) {
    const wrapper = mountPage();
    activeWith(configuration);
    await nextTick();
    return wrapper;
  }

  it('renders the status once, after the rail, sticky with it', async () => {
    const wrapper = await formWith(makeSectionTreeConfiguration());
    const statuses = wrapper.findAll('[data-testid="required-status"]');
    expect(statuses).toHaveLength(1);

    const status = statuses[0]!.element;
    const rail = wrapper.find('[data-testid="configurator-rail"]').element;
    expect(status.closest('[data-testid="configurator-rail"]')).toBeNull();
    expect(
      rail.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // One sticky wrapper holds both, so the status stays under the rail.
    const holder = status.parentElement!;
    expect(holder.contains(rail)).toBe(true);
    expect(holder.className).toContain('lg:sticky');
    expect(holder.className).toContain('lg:top-48');
  });

  it('ends the sticky column above the viewport bottom, the rail keeping its height', async () => {
    // 13rem is the 192 px sticky top plus 16 px of air, as for the aside. The
    // rail and its divider do not shrink, so what is left goes to the status.
    const wrapper = await formWith(makeSectionTreeConfiguration());
    const status = wrapper.find('[data-testid="required-status"]').element;
    const holder = status.parentElement!;
    expect(Array.from(holder.classList)).toEqual(
      expect.arrayContaining([
        'lg:flex',
        'lg:flex-col',
        'lg:max-h-[calc(100vh-13rem)]',
      ]),
    );
    expect(
      wrapper.find('[data-testid="configurator-rail"]').classes(),
    ).toContain('lg:shrink-0');
    expect(status.previousElementSibling!.classList).toContain('lg:shrink-0');
  });

  it('shows the status at every width, while the rail is hidden below lg', async () => {
    // Below lg the holder is the first cell of the form grid, so the status
    // stands above the form.
    const wrapper = await formWith(makeSectionTreeConfiguration());
    const status = wrapper.find('[data-testid="required-status"]').element;
    const rail = wrapper.find('[data-testid="configurator-rail"]');
    expect(rail.classes()).toEqual(
      expect.arrayContaining(['hidden', 'lg:block']),
    );

    for (
      let node = status;
      node !== wrapper.element;
      node = node.parentElement!
    ) {
      expect(node.classList.contains('hidden')).toBe(false);
    }
    expect(
      status.parentElement!.compareDocumentPosition(
        wrapper.find('[data-testid="configurator-form-slot"]').element,
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('hands the status the document on screen', async () => {
    const valid = await formWith(makeSectionTreeConfiguration());
    expect(
      valid.find('[data-testid="required-status"]').attributes('data-valid'),
    ).toBe(String(makeSectionTreeConfiguration().isValid));
  });

  it('keeps the status for a document with no visible section', async () => {
    // With no rail and no form the status is the only reason the action is
    // disabled.
    const wrapper = await formWith(
      makeValidConfiguration({ sections: [], isValid: false }),
    );
    expect(wrapper.find('[data-testid="configurator-rail"]').exists()).toBe(
      false,
    );
    expect(
      wrapper.find('[data-testid="required-status"]').attributes('data-valid'),
    ).toBe('false');
  });

  it('renders no status while the session starts', () => {
    const wrapper = mountPage();
    expect(wrapper.find('[data-testid="required-status"]').exists()).toBe(
      false,
    );
  });

  it('renders no status beside the committed summary', async () => {
    const wrapper = await formWith(makeSectionTreeConfiguration());
    session.committed.value = COMMITTED;
    session.status.value = 'closed';
    await nextTick();
    expect(wrapper.find('[data-testid="required-status"]').exists()).toBe(
      false,
    );
  });

  it('renders no status once the session has expired', async () => {
    const wrapper = await formWith(makeSectionTreeConfiguration());
    session.status.value = 'expired';
    await nextTick();
    expect(wrapper.find('[data-testid="required-status"]').exists()).toBe(
      false,
    );
  });
});

describe('ConfiguratorProduct missing items', () => {
  let scrolled: { element: Element; options: unknown }[] = [];

  beforeEach(() => {
    scrolled = [];
    Element.prototype.scrollIntoView = vi.fn(function (
      this: Element,
      options?: unknown,
    ) {
      scrolled.push({ element: this, options });
    });
  });

  async function goTo(item: BlockingItem) {
    const wrapper = mountPage();
    activeWith(makeSectionTreeConfiguration());
    await nextTick();
    goToTarget.value = item;
    await wrapper.find('[data-testid="required-go-to"]').trigger('click');
    await flushPromises();
    return wrapper;
  }

  it('opens the section a missing item is in', async () => {
    const wrapper = await goTo({
      name: 'Industrial',
      sectionId: 'edge-trim',
      kind: 'group',
      nodeId: 'industrial',
    });

    expect(
      wrapper.find('[data-testid="section"]').attributes('data-section-id'),
    ).toBe('edge-trim');
  });

  it('brings the group into view, its top below the sticky header', async () => {
    await goTo({
      name: 'Industrial',
      sectionId: 'edge-trim',
      kind: 'group',
      nodeId: 'industrial',
    });

    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]!.element.getAttribute('data-group-id')).toBe(
      'industrial',
    );
    expect(scrolled[0]!.options).toEqual({
      behavior: 'smooth',
      block: 'start',
    });
    // The offset is the element's own: the header is 11rem, as on the tab row.
    expect((scrolled[0]!.element as HTMLElement).style.scrollMarginTop).toBe(
      '11rem',
    );
  });

  it('brings a variable into view by its own attribute', async () => {
    await goTo({
      name: 'Width',
      sectionId: 'frame',
      kind: 'variable',
      nodeId: 'width',
    });

    expect(
      scrolled.map((s) => s.element.getAttribute('data-variable-id')),
    ).toEqual(['width']);
  });

  it('scrolls when the section is the one already open', async () => {
    // Frame is the first entry, so nothing changes but the scroll.
    const wrapper = await goTo({
      name: 'Legs',
      sectionId: 'frame',
      kind: 'group',
      nodeId: 'legs',
    });

    expect(
      wrapper.find('[data-testid="section"]').attributes('data-section-id'),
    ).toBe('frame');
    expect(
      scrolled.map((s) => s.element.getAttribute('data-group-id')),
    ).toEqual(['legs']);
  });
});

describe('ConfiguratorProduct editing a cart line', () => {
  const LINE = { cartId: 'cart-1', itemId: 'item-1' };

  function editingLine(): void {
    session.editing.value = LINE;
    activeWith(makeValidConfiguration());
  }

  it("opens the line the query names in the buyer's cart, instead of a fresh session", async () => {
    cartStore.cartId = 'cart-1';
    route.value.query = { cart: 'cart-1', line: 'item-1' };

    mountPage();
    await flushPromises();

    expect(session.edit).toHaveBeenCalledWith('1101', LINE);
    expect(session.start).not.toHaveBeenCalled();
  });

  it('starts an ordinary session, says the line is gone and drops the query, for a link to another cart', async () => {
    cartStore.cartId = 'cart-9';
    route.value.query = { cart: 'cart-1', line: 'item-1', keep: 'x' };

    const wrapper = mountPage();
    await flushPromises();
    activeWith(makeValidConfiguration());
    await nextTick();

    expect(session.edit).not.toHaveBeenCalled();
    expect(session.start).toHaveBeenCalledWith('1101');
    expect(router.replace).toHaveBeenCalledWith({ query: { keep: 'x' } });
    expect(
      wrapper.find('[data-testid="configurator-edit-notice"]').text(),
    ).toBe('configurator.edit.line_gone');
  });

  it("starts editing when the query comes to name a line on a page already open, which is the drawer's link on the same product", async () => {
    cartStore.cartId = 'cart-1';
    mountPage();
    await flushPromises();
    activeWith(makeValidConfiguration());
    session.release.mockClear();

    route.value.query = { cart: 'cart-1', line: 'item-1' };
    await flushPromises();

    // Every page this file mounted is still mounted and follows the same
    // route, so the calls are counted by order, not by number.
    expect(session.edit).toHaveBeenCalledWith('1101', LINE);
    expect(session.release).toHaveBeenCalled();
    expect(session.release.mock.invocationCallOrder[0]).toBeLessThan(
      session.edit.mock.invocationCallOrder[0]!,
    );
  });

  it('waits for a request under way, such as the reopen after an add, before it opens the line', async () => {
    cartStore.cartId = 'cart-1';
    mountPage();
    await flushPromises();
    session.busy.value = true;

    route.value.query = { cart: 'cart-1', line: 'item-1' };
    await flushPromises();
    expect(session.edit).not.toHaveBeenCalled();

    session.busy.value = false;
    await flushPromises();
    expect(session.edit).toHaveBeenCalledWith('1101', LINE);
  });

  it('opens nothing again when the query names the line already being edited', async () => {
    cartStore.cartId = 'cart-1';
    route.value.query = { cart: 'cart-1', line: 'item-1' };
    mountPage();
    await flushPromises();
    editingLine();
    session.edit.mockClear();

    route.value.query = { cart: 'cart-1', line: 'item-1', tab: 'x' };
    await flushPromises();

    expect(session.edit).not.toHaveBeenCalled();
  });

  it("forgets a stale link's notice once the buyer adds", async () => {
    cartStore.cartId = 'cart-9';
    route.value.query = { cart: 'cart-1', line: 'item-1' };
    const wrapper = mountPage();
    await flushPromises();
    activeWith(makeValidConfiguration());
    await nextTick();
    expect(
      wrapper.find('[data-testid="configurator-edit-notice"]').exists(),
    ).toBe(true);

    await wrapper.find('[data-testid="configurator-commit"]').trigger('click');

    expect(
      wrapper.find('[data-testid="configurator-edit-notice"]').exists(),
    ).toBe(false);
  });

  it('marks the right column and puts the action in edit mode while a line is edited', async () => {
    const wrapper = mountPage();
    editingLine();
    await nextTick();

    expect(wrapper.find('[data-testid="configurator-editing"]').text()).toBe(
      'configurator.edit.marker',
    );
    expect(
      wrapper.find('[data-testid="action"]').attributes('data-editing'),
    ).toBe('true');
    expect(
      wrapper.find('[data-testid="panel"]').attributes('data-editing'),
    ).toBe('true');
  });

  it('shows neither outside edit mode', async () => {
    const wrapper = mountPage();
    activeWith(makeValidConfiguration());
    await nextTick();

    expect(wrapper.find('[data-testid="configurator-editing"]').exists()).toBe(
      false,
    );
    expect(
      wrapper.find('[data-testid="action"]').attributes('data-editing'),
    ).toBe('false');
  });

  it('puts the committed record on the edited line through the cart', async () => {
    mountPage();

    await expect(session.options.replaceLine(COMMITTED, LINE)).resolves.toEqual(
      LINE,
    );
    expect(cartStore.replaceConfiguredItem).toHaveBeenCalledWith(
      'committed-1',
      LINE,
    );
  });

  it('reverts from the action', async () => {
    const wrapper = mountPage();
    editingLine();
    await nextTick();

    await wrapper.find('[data-testid="action-revert"]').trigger('click');

    expect(session.revertEdit).toHaveBeenCalledTimes(1);
    expect(session.cancelEdit).not.toHaveBeenCalled();
  });

  it('cancels from the action, then opens the cart over the unchanged line and drops the query', async () => {
    route.value.query = { cart: 'cart-1', line: 'item-1' };
    cartStore.cartId = 'cart-1';
    const wrapper = mountPage();
    editingLine();
    await nextTick();
    session.cancelEdit.mockImplementationOnce(async () => {
      session.editing.value = null;
      await nextTick();
    });

    await wrapper.find('[data-testid="action-cancel"]').trigger('click');
    await flushPromises();

    expect(session.cancelEdit).toHaveBeenCalledTimes(1);
    expect(cartStore.isOpen).toBe(true);
    expect(router.replace).toHaveBeenCalledWith({ query: {} });
  });

  it('drops the query, and leaves the drawer to the cart, once an update has gone through', async () => {
    route.value.query = { cart: 'cart-1', line: 'item-1' };
    mountPage();
    editingLine();
    await nextTick();

    session.editing.value = null;
    await flushPromises();

    expect(router.replace).toHaveBeenCalledWith({ query: {} });
    expect(cartStore.isOpen).toBe(false);
  });

  it.each([
    ['not_reopenable', 'configurator.edit.not_reopenable'],
    ['line_gone', 'configurator.edit.line_gone'],
  ] as const)(
    'says above the form why the line is not on its own choices: %s',
    async (notice, key) => {
      const wrapper = mountPage();
      activeWith(makeValidConfiguration());
      session.editNotice.value = notice;
      await nextTick();

      const shown = wrapper.find('[data-testid="configurator-edit-notice"]');
      expect(shown.text()).toBe(key);
      expect(
        wrapper
          .find('[data-testid="configurator-form-slot"]')
          .element.contains(shown.element),
      ).toBe(true);
    },
  );

  it('says the line could not be opened and offers to try again, when the reopen failed', async () => {
    const wrapper = mountPage();
    session.editing.value = LINE;
    session.error.value = { status: 502, message: 'x' };
    await nextTick();

    expect(wrapper.find('[data-testid="configurator-error"]').text()).toBe(
      'configurator.edit.open_failed',
    );
    await wrapper
      .find('[data-testid="configurator-edit-retry"]')
      .trigger('click');
    expect(session.reopenLine).toHaveBeenCalledTimes(1);
  });

  it("opens the line's choices again, rather than a fresh session, when the session expired during the edit", async () => {
    const wrapper = mountPage();
    session.editing.value = LINE;
    session.configuration.value = makeValidConfiguration();
    session.status.value = 'expired';
    await nextTick();
    session.start.mockClear();

    await wrapper.find('[data-testid="panel-restart"]').trigger('click');
    await flushPromises();

    expect(session.reopenLine).toHaveBeenCalledTimes(1);
    expect(session.start).not.toHaveBeenCalled();
  });

  it('starts from the defaults from the reset button, still editing, as the design reference does', async () => {
    const wrapper = mountPage();
    editingLine();
    await nextTick();
    session.start.mockClear();

    await wrapper.find('[data-testid="configurator-reset"]').trigger('click');
    await flushPromises();

    expect(session.release).toHaveBeenCalled();
    expect(session.start).toHaveBeenCalledWith('1101');
    expect(session.reopenLine).not.toHaveBeenCalled();
  });

  it.each([
    [409, 'CONFLICT', 'configurator.edit.update_failed', true],
    [502, 'EXTERNAL_API_ERROR', 'configurator.edit.update_failed', true],
    [404, 'NOT_FOUND', 'configurator.edit.update_failed', false],
    [404, 'CART_LINE_GONE', 'configurator.edit.line_gone', false],
  ])(
    'says what a %i %s swap did to the line, retryable: %s',
    async (status, code, key, retryable) => {
      const wrapper = mountPage();
      session.editing.value = LINE;
      session.committed.value = COMMITTED;
      session.status.value = 'closed';
      session.error.value = { status, message: 'x', code };
      await nextTick();

      const retry = wrapper.find('[data-testid="add-retry"]');
      expect(retry.attributes('data-message')).toBe(key);
      expect(retry.attributes('data-retryable')).toBe(String(retryable));
      await wrapper
        .find('[data-testid="configurator-edit-leave"]')
        .trigger('click');
      expect(session.cancelEdit).toHaveBeenCalledTimes(1);
    },
  );
});

describe('ConfiguratorProduct replaying an order row', () => {
  const ORDER_ID = '6f1c2a9e-0b8d-4e3f-9a51-2c7d8e4b1f03';
  const ROW = { publicOrderId: ORDER_ID, row: 1 };

  it('replays the order row the query names, instead of a fresh session', async () => {
    route.value.query = { order: ORDER_ID, row: '1' };

    mountPage();
    await flushPromises();

    expect(session.replay).toHaveBeenCalledWith('1101', ROW);
    expect(session.start).not.toHaveBeenCalled();
  });

  it('edits the cart line rather than replaying, when the query names both', async () => {
    cartStore.cartId = 'cart-1';
    route.value.query = {
      cart: 'cart-1',
      line: 'item-1',
      order: ORDER_ID,
      row: '1',
    };

    mountPage();
    await flushPromises();

    expect(session.edit).toHaveBeenCalled();
    expect(session.replay).not.toHaveBeenCalled();
  });

  it("starts from the defaults, says the order's choices did not come back and drops the query, for a link it cannot replay", async () => {
    route.value.query = { order: 'not-a-guid', row: '1', keep: 'x' };

    const wrapper = mountPage();
    await flushPromises();
    activeWith(makeValidConfiguration());
    await nextTick();

    expect(session.replay).not.toHaveBeenCalled();
    expect(session.start).toHaveBeenCalledWith('1101');
    expect(router.replace).toHaveBeenCalledWith({ query: { keep: 'x' } });
    expect(
      wrapper.find('[data-testid="configurator-not-replayed"]').text(),
    ).toBe('configurator.not_replayed');
  });

  it('says at the top of the form that the choices did not come back after an expiry, when they did not', async () => {
    const wrapper = mountPage();
    activeWith(makeValidConfiguration());
    await nextTick();
    expect(
      wrapper.find('[data-testid="configurator-not-restored"]').exists(),
    ).toBe(false);

    session.notRestored.value = true;
    await nextTick();

    const notice = wrapper.find('[data-testid="configurator-not-restored"]');
    expect(notice.text()).toBe('configurator.not_restored');
    const slot = wrapper.find('[data-testid="configurator-form-slot"]');
    expect(slot.element.contains(notice.element)).toBe(true);
    expect(
      wrapper.find('[data-testid="configurator-not-replayed"]').exists(),
    ).toBe(false);
  });

  it("says at the top of the form that the order's choices did not come back, when they did not", async () => {
    const wrapper = mountPage();
    activeWith(makeValidConfiguration());
    await nextTick();
    expect(
      wrapper.find('[data-testid="configurator-not-replayed"]').exists(),
    ).toBe(false);

    session.notReplayed.value = true;
    await nextTick();

    const notice = wrapper.find('[data-testid="configurator-not-replayed"]');
    expect(notice.text()).toBe('configurator.not_replayed');
    const slot = wrapper.find('[data-testid="configurator-form-slot"]');
    expect(slot.element.contains(notice.element)).toBe(true);
  });

  it('drops the query once the line is in the cart, so a reload does not replay over it', async () => {
    route.value.query = { order: ORDER_ID, row: '1', keep: 'x' };
    mountPage(makeProduct({ skus: [{ skuId: 1652 }] }));
    await flushPromises();
    cartStore.addConfiguredItem.mockResolvedValueOnce({
      cartId: 'cart-1',
      itemId: 'item-1',
    });

    await session.options.addLine(COMMITTED);

    expect(router.replace).toHaveBeenCalledWith({ query: { keep: 'x' } });
  });

  it('keeps the query when the add fails, so the order row is still named', async () => {
    route.value.query = { order: ORDER_ID, row: '1' };
    mountPage(makeProduct({ skus: [{ skuId: 1652 }] }));
    await flushPromises();
    cartStore.addConfiguredItem.mockRejectedValueOnce(new Error('no'));

    router.replace.mockClear();

    await expect(session.options.addLine(COMMITTED)).rejects.toThrow('no');

    expect(router.replace).not.toHaveBeenCalled();
  });

  it('replays the order row again, rather than the defaults, when the session expired', async () => {
    route.value.query = { order: ORDER_ID, row: '1' };
    const wrapper = mountPage();
    await flushPromises();
    session.configuration.value = makeValidConfiguration();
    session.status.value = 'expired';
    await nextTick();
    session.replay.mockClear();

    await wrapper.find('[data-testid="panel-restart"]').trigger('click');
    await flushPromises();

    expect(session.release).toHaveBeenCalledTimes(1);
    expect(session.replay).toHaveBeenCalledWith('1101', ROW);
    expect(session.start).not.toHaveBeenCalled();
  });

  it('starts from the defaults from the reset button and drops the query', async () => {
    route.value.query = { order: ORDER_ID, row: '1' };
    const wrapper = mountPage();
    await flushPromises();
    activeWith(makeValidConfiguration());
    await nextTick();

    await wrapper.find('[data-testid="configurator-reset"]').trigger('click');
    await flushPromises();

    expect(session.start).toHaveBeenCalledWith('1101');
    expect(router.replace).toHaveBeenCalledWith({ query: {} });
  });
});
