import { describe, it, expect } from 'vitest';
import { shallowMountComponent } from '../../utils/component';
import LayoutHeaderNav from '../../../app/components/layout/header/LayoutHeaderNav.vue';

const rekaStubs = {
  NavigationMenuRoot: { template: '<div><slot /></div>' },
  NavigationMenuList: { template: '<div><slot /></div>' },
  NavigationMenuItem: { template: '<div><slot /></div>' },
  NavigationMenuTrigger: { template: '<button><slot /></button>' },
  NavigationMenuContent: { template: '<div><slot /></div>' },
  NavigationMenuLink: { template: '<div><slot /></div>' },
  NavigationMenuIndicator: { template: '<div />' },
  NavigationMenuViewport: { template: '<div />' },
  ChevronDown: { template: '<span />' },
};

describe('LayoutHeaderNav', () => {
  const mountOptions = {
    global: {
      stubs: rekaStubs,
    },
  };

  it('renders a nav element', () => {
    const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);
    expect(wrapper.find('nav').exists()).toBe(true);
  });

  it('renders placeholder menu items', () => {
    const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);
    expect(wrapper.text()).toContain('Product category');
  });

  it('is hidden on mobile (lg:flex)', () => {
    const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);
    expect(wrapper.find('nav').classes()).toContain('hidden');
    expect(wrapper.find('nav').classes()).toContain('lg:flex');
  });
});
