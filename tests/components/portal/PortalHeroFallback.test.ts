import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import PortalHeroFallback from '../../../app/components/portal/PortalHeroFallback.vue';

describe('PortalHeroFallback', () => {
  it('renders portal-hero-fallback element', () => {
    const wrapper = mountComponent(PortalHeroFallback);
    expect(wrapper.find('[data-testid="portal-hero-fallback"]').exists()).toBe(
      true,
    );
  });

  it('renders cms_hint label', () => {
    const wrapper = mountComponent(PortalHeroFallback);
    expect(wrapper.text()).toContain('portal.hero.cms_hint');
  });

  it('renders fallback title as h1', () => {
    const wrapper = mountComponent(PortalHeroFallback);
    const h1 = wrapper.find('h1');
    expect(h1.exists()).toBe(true);
    expect(h1.text()).toContain('portal.hero.fallback_title');
  });

  it('h1 has id portal-hero-title for aria-labelledby', () => {
    const wrapper = mountComponent(PortalHeroFallback);
    const h1 = wrapper.find('h1');
    expect(h1.attributes('id')).toBe('portal-hero-title');
  });

  it('section has aria-labelledby pointing to title', () => {
    const wrapper = mountComponent(PortalHeroFallback);
    const section = wrapper.find('[data-testid="portal-hero-fallback"]');
    expect(section.attributes('aria-labelledby')).toBe('portal-hero-title');
  });

  it('renders fallback subtitle', () => {
    const wrapper = mountComponent(PortalHeroFallback);
    expect(wrapper.text()).toContain('portal.hero.fallback_subtitle');
  });

  it('uses dark background class', () => {
    const wrapper = mountComponent(PortalHeroFallback);
    const section = wrapper.find('[data-testid="portal-hero-fallback"]');
    expect(section.classes()).toContain('bg-neutral-800');
  });
});
