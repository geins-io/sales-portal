import { describe, it, expect } from 'vitest';
import { mountComponent } from '../utils/component';
import BrandLogo from '../../app/components/shared/BrandLogo.vue';

describe('BrandLogo Component', () => {
  describe('rendering', () => {
    it('should render an image with src from tenant config', () => {
      const wrapper = mountComponent(BrandLogo);

      expect(wrapper.attributes('data-slot')).toBe('logo');
      const img = wrapper.find('img');
      expect(img.exists()).toBe(true);
      expect(img.attributes('src')).toBe('/logo.svg');
    });

    it('should use prop src over tenant logoUrl', () => {
      const wrapper = mountComponent(BrandLogo, {
        props: { src: '/custom-logo.png' },
      });

      const img = wrapper.find('img');
      expect(img.attributes('src')).toBe('/custom-logo.png');
    });

    it('should apply custom alt text', () => {
      const wrapper = mountComponent(BrandLogo, {
        props: { alt: 'My Brand' },
      });

      const img = wrapper.find('img');
      expect(img.attributes('alt')).toBe('My Brand');
    });

    it('should fall back to brandName for alt', () => {
      const wrapper = mountComponent(BrandLogo);

      const img = wrapper.find('img');
      // From test setup, brandName = 'Test Store'
      expect(img.attributes('alt')).toBe('Test Store');
    });
  });

  describe('linking', () => {
    it('should wrap in a link when linked=true (default)', () => {
      const wrapper = mountComponent(BrandLogo);

      // NuxtLink is stubbed as <a>
      expect(wrapper.element.tagName).toBe('A');
    });

    it('should wrap in a span when linked=false', () => {
      const wrapper = mountComponent(BrandLogo, {
        props: { linked: false },
      });

      expect(wrapper.element.tagName).toBe('SPAN');
    });
  });

  describe('height', () => {
    it('should apply default h-8 height class', () => {
      const wrapper = mountComponent(BrandLogo);

      const img = wrapper.find('img');
      expect(img.classes()).toContain('h-8');
    });

    it('should apply custom height class', () => {
      const wrapper = mountComponent(BrandLogo, {
        props: { height: 'h-12' },
      });

      const img = wrapper.find('img');
      expect(img.classes()).toContain('h-12');
    });
  });

  describe('dark mode', () => {
    it('should render two images when srcDark is provided', () => {
      const wrapper = mountComponent(BrandLogo, {
        props: {
          src: '/logo-light.png',
          srcDark: '/logo-dark.png',
        },
      });

      const imgs = wrapper.findAll('img');
      expect(imgs.length).toBe(2);
      expect(imgs[0].classes()).toContain('dark:hidden');
      expect(imgs[1].classes()).toContain('dark:block');
    });
  });

  describe('responsive symbol', () => {
    it('should render symbol image with responsive classes when srcSymbol is provided', () => {
      const wrapper = mountComponent(BrandLogo, {
        props: {
          src: '/logo-full.png',
          srcSymbol: '/logo-symbol.png',
        },
      });

      const imgs = wrapper.findAll('img');
      expect(imgs.length).toBe(2);

      // Symbol: visible on small, hidden on md+
      expect(imgs[0].classes()).toContain('block');
      expect(imgs[0].classes()).toContain('md:hidden');

      // Full: hidden on small, visible on md+
      expect(imgs[1].classes()).toContain('hidden');
      expect(imgs[1].classes()).toContain('md:block');
    });
  });
});
