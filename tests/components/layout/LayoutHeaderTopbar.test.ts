import { describe, it, expect } from 'vitest';
import { shallowMountComponent } from '../../utils/component';
import LayoutHeaderTopbar from '../../../app/components/layout/header/LayoutHeaderTopbar.vue';

describe('LayoutHeaderTopbar', () => {
  it('paints bg-top-bar-background on the topbar surface', () => {
    const wrapper = shallowMountComponent(LayoutHeaderTopbar);
    const topbar = wrapper.find('[data-slot="topbar"]');
    expect(topbar.exists()).toBe(true);
    expect(topbar.classes()).toContain('bg-top-bar-background');
    expect(topbar.classes()).not.toContain('bg-primary');
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
