import { describe, it, expect, vi, beforeEach, assert } from 'vitest';
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
    status: ref('success'),
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
    template: '<div data-testid="frontpage-fallback" />',
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
