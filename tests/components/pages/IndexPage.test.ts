import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  assert,
} from 'vitest';
import { ref } from 'vue';
import { mountComponent } from '../../utils/component';
import IndexPage from '../../../app/pages/index.vue';
import { useTenant } from '../../../app/composables/useTenant';

/**
 * The landing page resolves `CMS_SLOTS.FRONTPAGE_CONTENT` against the tenant
 * config and fetches whatever `(family, areaName)` that slot names. Nothing
 * asserted the second half of that: the page had no spec at all.
 *
 * The recipe is PortalShell.test.ts's. `useCmsSlot` is left unmocked, so the
 * configured value travels the app's own path, and the fetch stub answers on
 * the `areaName` the config produced. Point the config somewhere else and the
 * stub no longer matches — which is what makes these `field` assertions about
 * the config rather than assertions about a hand-fed area.
 *
 * The page lives under `tests/components/` rather than a `tests/pages/`
 * directory because the components tier's include is `tests/components/**` and
 * no project's include covers `tests/pages/`: a spec there is collected by
 * nobody and vitest exits with "No test files found".
 */
const mockCmsAreas = new Map<string, { containers: unknown[] }>();
let mockFetchStatus = 'success';

type AreaQuery = { areaName?: string };

const mockUseFetch = vi.fn((_url: unknown, options?: { query?: unknown }) => {
  const raw = options?.query;
  // The page builds `query` as a computed, so unwrap before reading areaName.
  const resolved =
    raw != null && typeof raw === 'object' && 'value' in raw
      ? (raw as { value: AreaQuery }).value
      : (raw as AreaQuery | undefined);
  const areaName = resolved?.areaName;
  return {
    data: ref(
      areaName !== undefined ? (mockCmsAreas.get(areaName) ?? null) : null,
    ),
    status: ref(mockFetchStatus),
    error: ref(null),
    pending: ref(false),
    refresh: vi.fn(),
    execute: vi.fn(),
  };
});

vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: Parameters<typeof mockUseFetch>) => mockUseFetch(...args),
}));
vi.stubGlobal('useFetch', mockUseFetch);
vi.stubGlobal('useSeoLinks', vi.fn());

const stubs = {
  CmsWidgetArea: {
    template: '<div data-testid="frontpage-area" />',
    props: ['containers'],
  },
  FrontpageFallback: {
    template:
      '<section data-testid="frontpage-fallback"><h1>Welcome</h1></section>',
  },
};

/** The area the shared setup fixture configures for this slot. */
const CONFIGURED_AREA = 'Content';

function configureFrontpageSlot(areaName: string | null) {
  const { tenant } = useTenant();
  const current = tenant.value;
  assert.isDefined(current);
  tenant.value = {
    ...current,
    cms: {
      slots:
        areaName === null
          ? {}
          : { frontpage_content: { family: 'Frontpage', areaName } },
    },
  };
}

describe('index page CMS area', () => {
  beforeEach(() => {
    mockCmsAreas.clear();
    configureFrontpageSlot(CONFIGURED_AREA);
  });

  it('renders the frontpage area the configured slot names', () => {
    mockCmsAreas.set(CONFIGURED_AREA, { containers: [{ id: 'c1' }] });

    const wrapper = mountComponent(IndexPage, { global: { stubs } });

    expect(wrapper.find('[data-testid="frontpage-area"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="frontpage-fallback"]').exists()).toBe(
      false,
    );
  });

  it('falls back when the configured slot names a different area', () => {
    // Same area content available, different name in the config. Without this
    // half the case above would pass on any config at all.
    configureFrontpageSlot('Some Other Area');
    mockCmsAreas.set(CONFIGURED_AREA, { containers: [{ id: 'c1' }] });

    const wrapper = mountComponent(IndexPage, { global: { stubs } });

    expect(wrapper.find('[data-testid="frontpage-area"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="frontpage-fallback"]').exists()).toBe(
      true,
    );
  });

  it('falls back when the tenant configures no frontpage slot', () => {
    configureFrontpageSlot(null);
    mockCmsAreas.set(CONFIGURED_AREA, { containers: [{ id: 'c1' }] });

    const wrapper = mountComponent(IndexPage, { global: { stubs } });

    expect(wrapper.find('[data-testid="frontpage-area"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="frontpage-fallback"]').exists()).toBe(
      true,
    );
  });
});

/**
 * The start page owns one visually hidden h1 whenever neither the fallback
 * nor a CMS widget renders one, so every branch ends up with exactly one.
 */
describe('index page h1', () => {
  type Tenant = NonNullable<ReturnType<typeof useTenant>['tenant']['value']>;
  let original: Tenant;

  const textWidget = (titleRenderMode: number) => ({
    config: { active: true, type: 'TextPageWidget' },
    data: { titleRenderMode, title: 'Widget title' },
  });

  // The first block leaves the slot in whatever state its last test set.
  function configureTenant(changes: Partial<Tenant>) {
    const { tenant } = useTenant();
    tenant.value = {
      ...original,
      cms: {
        slots: {
          frontpage_content: { family: 'Frontpage', areaName: CONFIGURED_AREA },
        },
      },
      ...changes,
    };
  }

  function mountWithArea(containers: unknown[] | null) {
    if (containers) mockCmsAreas.set(CONFIGURED_AREA, { containers });
    return mountComponent(IndexPage, { global: { stubs } });
  }

  beforeAll(() => {
    const { tenant } = useTenant();
    assert.isDefined(tenant.value);
    original = tenant.value;
  });

  beforeEach(() => {
    mockCmsAreas.clear();
    mockFetchStatus = 'success';
    configureTenant({});
  });

  it('renders one hidden h1 with the configured default title', () => {
    configureTenant({ seo: { defaultTitle: 'Sentinel Default Title' } });

    const headings = mountWithArea([
      { id: 'c1', content: [textWidget(1)] },
    ]).findAll('h1');

    expect(headings).toHaveLength(1);
    expect(headings[0]!.text()).toBe('Sentinel Default Title');
    expect(headings[0]!.classes()).toContain('sr-only');
  });

  it('treats an empty default title as absent and uses the brand name', () => {
    configureTenant({ seo: { defaultTitle: '' } });

    const headings = mountWithArea([{ id: 'c1' }]).findAll('h1');

    expect(headings).toHaveLength(1);
    expect(headings[0]!.text()).toBe('Test Store');
  });

  it('uses the brand name when the tenant sets no default title', () => {
    configureTenant({ seo: {} });

    const headings = mountWithArea([{ id: 'c1' }]).findAll('h1');

    expect(headings).toHaveLength(1);
    expect(headings[0]!.text()).toBe('Test Store');
  });

  it('never renders an empty h1 when the brand name is empty too', () => {
    configureTenant({
      seo: null,
      branding: { ...original.branding, name: '' },
    });

    const headings = mountWithArea([{ id: 'c1' }]).findAll('h1');

    expect(headings).toHaveLength(1);
    expect(headings[0]!.text()).toBe('frontpage.fallback.welcome');
  });

  it('leaves the h1 to a CMS widget that renders one', () => {
    const wrapper = mountWithArea([{ id: 'c1', content: [textWidget(0)] }]);

    expect(wrapper.find('[data-testid="frontpage-area"]').exists()).toBe(true);
    expect(wrapper.findAll('h1')).toHaveLength(0);
  });

  it('renders its h1 while the area is still loading', () => {
    mockFetchStatus = 'pending';

    expect(mountWithArea(null).findAll('h1')).toHaveLength(1);
  });

  it('leaves the h1 to the fallback', () => {
    const wrapper = mountWithArea(null);

    expect(wrapper.find('[data-testid="frontpage-fallback"]').exists()).toBe(
      true,
    );
    const headings = wrapper.findAll('h1');
    expect(headings).toHaveLength(1);
    expect(headings[0]!.text()).toBe('Welcome');
  });
});
