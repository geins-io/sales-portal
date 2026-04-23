import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import FrontpageFallback from '../../../app/components/cms/FrontpageFallback.vue';

describe('FrontpageFallback', () => {
  it('renders the frontpage-fallback element so consumers can assert it', () => {
    const wrapper = mountComponent(FrontpageFallback);
    expect(wrapper.find('[data-testid="frontpage-fallback"]').exists()).toBe(
      true,
    );
  });

  it('uses the branded welcome key when tenant has a branding.name', () => {
    // The useTenant mock in setup-components.ts provides
    // `branding.name: "Test Store"`, so the template picks the named
    // key. (The passthrough t mock returns the key literal, so we
    // assert on the key rather than a rendered string.)
    const wrapper = mountComponent(FrontpageFallback);
    expect(wrapper.text()).toContain('frontpage.fallback.welcome_named');
    expect(wrapper.text()).not.toContain('frontpage.fallback.welcome ');
  });

  it('renders the subtitle copy', () => {
    const wrapper = mountComponent(FrontpageFallback);
    expect(wrapper.text()).toContain('frontpage.fallback.subtitle');
  });

  it('h1 id matches the aria-labelledby on the section', () => {
    const wrapper = mountComponent(FrontpageFallback);
    const h1 = wrapper.find('h1');
    const section = wrapper.find('[data-testid="frontpage-fallback"]');
    expect(h1.attributes('id')).toBe('frontpage-fallback-title');
    expect(section.attributes('aria-labelledby')).toBe(
      'frontpage-fallback-title',
    );
  });
});
