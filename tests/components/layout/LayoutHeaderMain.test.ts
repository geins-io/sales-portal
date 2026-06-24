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

  it('always draws a bottom border on mobile and drops it on desktop for the grey variant', () => {
    // The desktop nav row that separates this row from the page is hidden
    // below lg, so the grey variant still needs a mobile-only separator.
    const wrapper = shallowMountComponent(LayoutHeaderMain, {
      props: { navVariant: 'grey' },
    });
    const root = wrapper.find('div');
    expect(root.classes()).toContain('border-b');
    expect(root.classes()).toContain('lg:border-b-0');
  });

  it('keeps the bottom border at all widths for the white variant', () => {
    const wrapper = shallowMountComponent(LayoutHeaderMain, {
      props: { navVariant: 'white' },
    });
    const root = wrapper.find('div');
    expect(root.classes()).toContain('border-b');
    expect(root.classes()).not.toContain('lg:border-b-0');
  });
});
