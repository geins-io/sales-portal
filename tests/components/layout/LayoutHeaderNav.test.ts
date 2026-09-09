import { describe, it, expect, vi, beforeEach, assert } from 'vitest';
import { ref } from 'vue';
import { shallowMountComponent } from '../../utils/component';
import LayoutHeaderNav from '../../../app/components/layout/header/LayoutHeaderNav.vue';
import { useTenant } from '../../../app/composables/useTenant';

import type { MenuType } from '@geins/types';

const mockMenu = ref<MenuType | null>(null);

/**
 * The menu location the tenant config names for `cms.menus.header_main`.
 *
 * The fetch stub used to answer with `mockMenu` for every call, so the nav
 * rendered the stubbed response whatever the config said — swapping the
 * component to another menu key would not have failed a single test here.
 * Keying the stub on the `menuLocationId` the config produced is what binds
 * these assertions to the config: `useCmsMenuData` resolves the key through
 * `useCmsMenu`, and the id it puts in the query is the configured one.
 *
 * That binding is file-wide on purpose. Every test here now goes through the
 * configured path, so pointing the component at another menu key turns eight
 * of them red rather than one. That is the dependency, not a brittle spec:
 * before this, not a single test in the file would have noticed the swap.
 */
// Change this and seven tests go red, six of them rendering tests whose titles
// say nothing about configuration. That is the binding working, not a broken
// component: `renders the header_main menu from the configured menuLocationId`
// falls alongside them and is the one that explains why.
const HEADER_MENU_LOCATION = 'header-main-location';

type MenuQuery = { menuLocationId?: string };

function menuFetchReturn(_url: unknown, options?: { query?: unknown }) {
  const raw = options?.query;
  // `query` is a computed in useCmsMenuData; unwrap before reading the id.
  const resolved =
    raw != null && typeof raw === 'object' && 'value' in raw
      ? (raw as { value: MenuQuery }).value
      : (raw as MenuQuery | undefined);
  return {
    data:
      resolved?.menuLocationId === HEADER_MENU_LOCATION ? mockMenu : ref(null),
    pending: ref(false),
    error: ref(null),
    refresh: vi.fn(),
    execute: vi.fn(),
    status: ref('success'),
  };
}

vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: Parameters<typeof menuFetchReturn>) =>
    menuFetchReturn(...args),
  $fetch: vi.fn(),
}));

vi.stubGlobal('useFetch', menuFetchReturn);

function configureHeaderMenu(menuLocationId: string | null) {
  const { tenant } = useTenant();
  const current = tenant.value;
  assert.isDefined(current);
  tenant.value = {
    ...current,
    cms: {
      ...current.cms,
      menus: menuLocationId === null ? {} : { header_main: { menuLocationId } },
    },
  };
}

// Mock useRequestURL
vi.stubGlobal('useRequestURL', () => new URL('https://test.example.com'));

// Stubs for shadcn-vue navigation-menu wrappers + Nuxt auto-resolved names
const navStubs = {
  // shadcn-vue component names (from explicit import)
  NavigationMenu: { template: '<div><slot /></div>' },
  NavigationMenuList: { template: '<div><slot /></div>' },
  NavigationMenuItem: { template: '<div><slot /></div>' },
  NavigationMenuTrigger: { template: '<button><slot /></button>' },
  NavigationMenuContent: { template: '<div><slot /></div>' },
  NavigationMenuLink: { template: '<div><slot /></div>' },
  // Nuxt auto-resolved names (ui prefix)
  UiNavigationMenu: { template: '<div><slot /></div>' },
  UiNavigationMenuList: { template: '<div><slot /></div>' },
  UiNavigationMenuItem: { template: '<div><slot /></div>' },
  UiNavigationMenuTrigger: { template: '<button><slot /></button>' },
  UiNavigationMenuContent: { template: '<div><slot /></div>' },
  UiNavigationMenuLink: { template: '<div><slot /></div>' },
  ChevronDown: { template: '<span />' },
  NuxtLink: { template: '<a><slot /></a>' },
};

describe('LayoutHeaderNav', () => {
  const mountOptions = { global: { stubs: navStubs } };

  beforeEach(() => {
    configureHeaderMenu(HEADER_MENU_LOCATION);
  });

  it('renders the header_main menu from the configured menuLocationId', () => {
    mockMenu.value = {
      id: '1',
      title: 'Main',
      menuItems: [
        { id: '1', label: 'Epoxi', canonicalUrl: '/se/sv/l/epoxi', order: 1 },
      ],
    };

    const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);

    expect(wrapper.find('nav').exists()).toBe(true);
    expect(wrapper.text()).toContain('Epoxi');
  });

  it('renders no nav when header_main names a different menuLocationId', () => {
    // Same menu available, different id in the config. Without this half the
    // case above would pass on any config at all — which is exactly what the
    // blanket fetch stub used to do.
    configureHeaderMenu('some-other-location');
    mockMenu.value = {
      id: '1',
      title: 'Main',
      menuItems: [
        { id: '1', label: 'Epoxi', canonicalUrl: '/se/sv/l/epoxi', order: 1 },
      ],
    };

    const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);

    expect(wrapper.find('nav').exists()).toBe(false);
  });

  it('renders no nav when the tenant configures no header_main menu', () => {
    configureHeaderMenu(null);
    mockMenu.value = {
      id: '1',
      title: 'Main',
      menuItems: [
        { id: '1', label: 'Epoxi', canonicalUrl: '/se/sv/l/epoxi', order: 1 },
      ],
    };

    const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);

    expect(wrapper.find('nav').exists()).toBe(false);
  });

  it('renders nothing when menu is null', () => {
    mockMenu.value = null;
    const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);
    expect(wrapper.find('nav').exists()).toBe(false);
  });

  it('renders nothing when menuItems is empty', () => {
    mockMenu.value = { id: '1', title: 'Main', menuItems: [] };
    const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);
    expect(wrapper.find('nav').exists()).toBe(false);
  });

  it('renders top-level menu items', () => {
    mockMenu.value = {
      id: '1',
      title: 'Main',
      menuItems: [
        { id: '1', label: 'Epoxi', canonicalUrl: '/se/sv/l/epoxi', order: 1 },
        {
          id: '2',
          label: 'Fixturer',
          canonicalUrl: '/se/sv/l/fixturer',
          order: 2,
        },
      ],
    };
    const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);
    expect(wrapper.text()).toContain('Epoxi');
    expect(wrapper.text()).toContain('Fixturer');
  });

  it('filters out hidden items', () => {
    mockMenu.value = {
      id: '1',
      title: 'Main',
      menuItems: [
        { id: '1', label: 'Visible', order: 1 },
        { id: '2', label: 'Hidden', hidden: true, order: 2 },
      ],
    };
    const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);
    expect(wrapper.text()).toContain('Visible');
    expect(wrapper.text()).not.toContain('Hidden');
  });

  it('renders children in dropdown for items with children', () => {
    mockMenu.value = {
      id: '1',
      title: 'Main',
      menuItems: [
        {
          id: '1',
          label: 'Category',
          order: 1,
          children: [
            { id: '1-1', label: 'Sub A', canonicalUrl: '/sub-a', order: 1 },
            { id: '1-2', label: 'Sub B', canonicalUrl: '/sub-b', order: 2 },
          ],
        },
      ],
    };
    const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);
    expect(wrapper.text()).toContain('Sub A');
    expect(wrapper.text()).toContain('Sub B');
  });

  it('caps the mega menu height and scrolls its contents internally', () => {
    mockMenu.value = {
      id: '1',
      title: 'Main',
      menuItems: [
        {
          id: '1',
          label: 'Category',
          order: 1,
          children: [
            { id: '1-1', label: 'Sub A', canonicalUrl: '/sub-a', order: 1 },
          ],
        },
      ],
    };
    const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);
    const panel = wrapper.find('.overflow-y-auto');
    // Tall categories must scroll inside the panel, never the page behind it.
    expect(panel.exists()).toBe(true);
    // A max-height cap is what bounds the panel; value stays a tuning knob, so
    // assert the cap exists rather than pinning the exact pixel target.
    expect(panel.classes().some((c) => c.startsWith('max-h-['))).toBe(true);
  });

  it('always paints bg-nav-bar-background (tenant theme drives colour, with var(--muted) fallback)', () => {
    mockMenu.value = {
      id: '1',
      title: 'Main',
      menuItems: [{ id: '1', label: 'Item', order: 1 }],
    };
    for (const variant of ['grey', 'white'] as const) {
      const wrapper = shallowMountComponent(LayoutHeaderNav, {
        ...mountOptions,
        props: { variant },
      });
      const nav = wrapper.find('nav');
      expect(nav.classes()).toContain('bg-nav-bar-background');
      expect(nav.classes()).not.toContain('bg-muted');
      expect(nav.classes()).not.toContain('bg-background');
    }
  });

  it('is hidden on mobile (lg:flex)', () => {
    mockMenu.value = {
      id: '1',
      title: 'Main',
      menuItems: [{ id: '1', label: 'Item', order: 1 }],
    };
    const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);
    const nav = wrapper.find('nav');
    expect(nav.classes()).toContain('hidden');
    expect(nav.classes()).toContain('lg:flex');
  });
});
