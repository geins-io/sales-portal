import { describe, it, expect } from 'vitest';
import { mountComponent } from '../utils/component';
import Copyright from '../../app/components/shared/Copyright.vue';

describe('Copyright Component', () => {
  it('should render with data-slot="copyright"', () => {
    const wrapper = mountComponent(Copyright);
    expect(wrapper.attributes('data-slot')).toBe('copyright');
  });

  it('should display the current year', () => {
    const wrapper = mountComponent(Copyright);
    const year = new Date().getFullYear();
    expect(wrapper.text()).toContain(String(year));
  });

  it('should display the brand name from tenant', () => {
    const wrapper = mountComponent(Copyright);
    // From test setup, brandName = 'Test Store'
    expect(wrapper.text()).toContain('Test Store');
  });

  it('should include "All rights reserved"', () => {
    const wrapper = mountComponent(Copyright);
    expect(wrapper.text()).toContain('All rights reserved.');
  });
});
