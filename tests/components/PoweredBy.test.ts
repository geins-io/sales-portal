import { describe, it, expect } from 'vitest';
import { mountComponent } from '../utils/component';
import PoweredBy from '../../app/components/shared/PoweredBy.vue';
import { poweredByVariants } from '../../app/lib/powered-by';

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
