import { describe, it, expect, vi } from 'vitest';
import { shallowMountComponent } from '../../utils/component';
import LayoutHeader from '../../../app/components/layout/LayoutHeader.vue';

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
