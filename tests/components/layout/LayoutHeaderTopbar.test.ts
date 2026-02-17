import { describe, it, expect } from 'vitest';
import { shallowMountComponent } from '../../utils/component';
import LayoutHeaderTopbar from '../../../app/components/layout/header/LayoutHeaderTopbar.vue';

describe('LayoutHeaderTopbar', () => {
  it('renders with primary background', () => {
    const wrapper = shallowMountComponent(LayoutHeaderTopbar);
    expect(wrapper.find('[data-slot="topbar"]').exists()).toBe(true);
    expect(wrapper.find('[data-slot="topbar"]').classes()).toContain(
      'bg-primary',
    );
  });

  it('renders contact link', () => {
    const wrapper = shallowMountComponent(LayoutHeaderTopbar);
    expect(wrapper.text()).toContain('layout.contact_us');
  });

  it('renders login link when not authenticated', () => {
    const wrapper = shallowMountComponent(LayoutHeaderTopbar);
    expect(wrapper.text()).toContain('auth.login');
  });

  it('renders locale switcher stub', () => {
    const wrapper = shallowMountComponent(LayoutHeaderTopbar);
    expect(wrapper.find('locale-switcher-stub').exists()).toBe(true);
  });
});
