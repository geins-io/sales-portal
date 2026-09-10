import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { shallowMountComponent } from '../../utils/component';
import LayoutHeader from '../../../app/components/layout/LayoutHeader.vue';
import LayoutHeaderNav from '../../../app/components/layout/header/LayoutHeaderNav.vue';

const state = vi.hoisted(() => ({
  headerNavVariant: undefined as 'grey' | 'white' | undefined,
}));

vi.mock('../../../app/composables/useTenant', () => ({
  useTenant: () => ({
    tenant: ref({
      layout: state.headerNavVariant
        ? { headerNavVariant: state.headerNavVariant }
        : {},
    }),
  }),
}));

vi.stubGlobal('useRequestURL', () => new URL('https://test.example.com'));

describe('LayoutHeader root', () => {
  it('does not paint bg-top-bar-background on the outer header (children paint)', () => {
    const wrapper = shallowMountComponent(LayoutHeader);
    const header = wrapper.find('header');
    expect(header.exists()).toBe(true);
    expect(header.classes()).not.toContain('bg-top-bar-background');
  });

  it('stays sticky at the top with the expected layout classes', () => {
    const wrapper = shallowMountComponent(LayoutHeader);
    const header = wrapper.find('header');
    expect(header.classes()).toContain('sticky');
    expect(header.classes()).toContain('top-0');
    expect(header.classes()).toContain('z-50');
  });
});

/**
 * The variant has two observable effects and the tests below assert both: the
 * shadow that separates a white nav from the header above it, and the value
 * handed down to the two children that paint the nav.
 */
describe('LayoutHeader nav variant from layout.headerNavVariant', () => {
  beforeEach(() => {
    state.headerNavVariant = undefined;
  });

  function variantHandedDown(
    wrapper: ReturnType<typeof shallowMountComponent>,
  ) {
    return wrapper.findComponent(LayoutHeaderNav).props('variant');
  }

  it('adds no shadow and hands down grey when headerNavVariant is grey', () => {
    state.headerNavVariant = 'grey';
    const wrapper = shallowMountComponent(LayoutHeader);

    expect(wrapper.find('header').classes()).not.toContain('shadow-sm');
    expect(variantHandedDown(wrapper)).toBe('grey');
  });

  it('adds the separating shadow and hands down white when headerNavVariant is white', () => {
    state.headerNavVariant = 'white';
    const wrapper = shallowMountComponent(LayoutHeader);

    expect(wrapper.find('header').classes()).toContain('shadow-sm');
    expect(variantHandedDown(wrapper)).toBe('white');
  });

  it('falls back to grey when the tenant configures no headerNavVariant', () => {
    const wrapper = shallowMountComponent(LayoutHeader);

    expect(wrapper.find('header').classes()).not.toContain('shadow-sm');
    expect(variantHandedDown(wrapper)).toBe('grey');
  });
});
