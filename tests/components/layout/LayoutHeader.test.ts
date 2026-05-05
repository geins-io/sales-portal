import { describe, it, expect, vi } from 'vitest';
import { shallowMountComponent } from '../../utils/component';
import LayoutHeader from '../../../app/components/layout/LayoutHeader.vue';

vi.stubGlobal('useRequestURL', () => new URL('https://test.example.com'));

describe('LayoutHeader root', () => {
  it('exposes bg-top-bar-background on the root header element', () => {
    const wrapper = shallowMountComponent(LayoutHeader);
    const header = wrapper.find('header');
    expect(header.exists()).toBe(true);
    expect(header.classes()).toContain('bg-top-bar-background');
  });

  it('keeps the bg-background fallback class for tenants without the var', () => {
    const wrapper = shallowMountComponent(LayoutHeader);
    const header = wrapper.find('header');
    expect(header.classes()).toContain('bg-background');
  });
});
