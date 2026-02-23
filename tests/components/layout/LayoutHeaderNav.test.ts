import { describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';
import { shallowMountComponent } from '../../utils/component';
import LayoutHeaderNav from '../../../app/components/layout/header/LayoutHeaderNav.vue';

// Mock useMenuData
import type { MenuType } from '@geins/types';

const mockMenu = ref<MenuType | null>(null);
const mockPending = ref(false);
vi.mock('~/composables/useMenuData', () => ({
  useMenuData: () => ({
    menu: mockMenu,
    pending: mockPending,
    error: ref(null),
  }),
}));

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
