import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computed, ref } from 'vue';
import { mountComponent } from '../utils/component';
import PoweredBy from '../../app/components/shared/PoweredBy.vue';
import { poweredByVariants } from '../../app/lib/powered-by';

/**
 * The tests below that pass `variant` as a prop exercise a path the app never
 * takes: the footer mounts `<PoweredBy />` with no props
 * (LayoutFooterBottom.vue:10) and the component falls back to
 * `watermark.value`. So the config cases drive `branding.watermark` through
 * useTenant and mount the component the way the footer does.
 */
const state = vi.hoisted(() => ({
  watermark: 'full' as 'full' | 'minimal' | 'none',
}));

vi.mock('../../app/composables/useTenant', () => ({
  useTenant: () => ({
    watermark: computed(() => state.watermark),
    tenant: ref({ branding: { watermark: state.watermark } }),
  }),
}));

describe('PoweredBy Component', () => {
  describe('rendering', () => {
    it('should render with variant="full" showing icon and label', () => {
      const wrapper = mountComponent(PoweredBy, {
        props: { variant: 'full' },
      });

      expect(wrapper.attributes('data-slot')).toBe('powered-by');
      expect(wrapper.find('svg').exists()).toBe(true);
      expect(wrapper.text()).toContain('Powered by Litium');
    });

    it('should render with variant="minimal" showing icon only', () => {
      const wrapper = mountComponent(PoweredBy, {
        props: { variant: 'minimal' },
      });

      expect(wrapper.find('svg').exists()).toBe(true);
      expect(wrapper.text()).not.toContain('Powered by Litium');
    });

    it('should not render with variant="none"', () => {
      const wrapper = mountComponent(PoweredBy, {
        props: { variant: 'none' as 'full' },
      });

      expect(wrapper.find('[data-slot="powered-by"]').exists()).toBe(false);
    });
  });

  describe('link attributes', () => {
    it('should have target="_blank" and rel="noopener noreferrer"', () => {
      const wrapper = mountComponent(PoweredBy, {
        props: { variant: 'full' },
      });

      expect(wrapper.attributes('target')).toBe('_blank');
      expect(wrapper.attributes('rel')).toBe('noopener noreferrer');
    });

    it('should link to litium.com by default', () => {
      const wrapper = mountComponent(PoweredBy, {
        props: { variant: 'full' },
      });

      expect(wrapper.attributes('href')).toBe('https://www.litium.com');
    });
  });

  describe('props', () => {
    it('should accept custom label', () => {
      const wrapper = mountComponent(PoweredBy, {
        props: { variant: 'full', label: 'Built with Litium' },
      });

      expect(wrapper.text()).toContain('Built with Litium');
    });

    it('should accept custom href', () => {
      const wrapper = mountComponent(PoweredBy, {
        props: { variant: 'full', href: 'https://example.com' },
      });

      expect(wrapper.attributes('href')).toBe('https://example.com');
    });
  });
});

describe('poweredByVariants', () => {
  it('should return classes for full variant', () => {
    const classes = poweredByVariants({ variant: 'full' });
    expect(classes).toContain('inline-flex');
    expect(classes).toContain('items-center');
  });

  it('should return classes for minimal variant', () => {
    const classes = poweredByVariants({ variant: 'minimal' });
    expect(classes).toContain('inline-flex');
    expect(classes).toContain('items-center');
  });

  it('should default to full variant', () => {
    const defaultClasses = poweredByVariants();
    const fullClasses = poweredByVariants({ variant: 'full' });
    expect(defaultClasses).toBe(fullClasses);
  });
});

describe('PoweredBy driven by branding.watermark', () => {
  beforeEach(() => {
    state.watermark = 'full';
  });

  it('renders the icon and the label when branding.watermark is full', () => {
    state.watermark = 'full';
    const wrapper = mountComponent(PoweredBy);

    expect(wrapper.find('[data-slot="powered-by"]').exists()).toBe(true);
    expect(wrapper.find('svg').exists()).toBe(true);
    expect(wrapper.text()).toContain('Powered by Litium');
  });

  it('renders the icon without the label when branding.watermark is minimal', () => {
    state.watermark = 'minimal';
    const wrapper = mountComponent(PoweredBy);

    expect(wrapper.find('[data-slot="powered-by"]').exists()).toBe(true);
    expect(wrapper.find('svg').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('Powered by Litium');
  });

  it('renders nothing at all when branding.watermark is none', () => {
    state.watermark = 'none';
    const wrapper = mountComponent(PoweredBy);

    expect(wrapper.find('[data-slot="powered-by"]').exists()).toBe(false);
    expect(wrapper.find('svg').exists()).toBe(false);
  });
});
