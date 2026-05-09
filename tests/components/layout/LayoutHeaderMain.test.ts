// tests/components/layout/LayoutHeaderMain.test.ts
import { describe, it, expect } from 'vitest';
import { shallowMountComponent } from '../../utils/component';
import LayoutHeaderMain from '../../../app/components/layout/header/LayoutHeaderMain.vue';

describe('LayoutHeaderMain', () => {
  it('paints bg-background on the wrapper (nav-bar-background belongs on the nav only)', () => {
    const wrapper = shallowMountComponent(LayoutHeaderMain);
    const root = wrapper.find('div');
    expect(root.classes()).toContain('bg-background');
    expect(root.classes()).not.toContain('bg-nav-bar-background');
  });

  it('renders the brand logo', () => {
    const wrapper = shallowMountComponent(LayoutHeaderMain);
    // shallowMount stubs child components — check for kebab-case stub
    expect(wrapper.find('brand-logo-stub').exists()).toBe(true);
  });

  it('renders search bar on desktop', () => {
    const wrapper = shallowMountComponent(LayoutHeaderMain);
    expect(wrapper.find('search-bar-stub').exists()).toBe(true);
  });

  it('renders action buttons', () => {
    const wrapper = shallowMountComponent(LayoutHeaderMain);
    expect(wrapper.find('layout-header-action-buttons-stub').exists()).toBe(
      true,
    );
  });
});
