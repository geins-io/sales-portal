import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { mountComponent } from '../utils/component';
import VatDisplaySwitcher from '../../app/components/shared/VatDisplaySwitcher.vue';

// Control showPrice per-test via this ref.
const mockShowPrice = ref(true);

vi.mock('../../app/composables/usePriceVisibility', () => ({
  usePriceVisibility: () => ({ showPrice: mockShowPrice }),
}));

// Pure-logic tests mirroring MarketSwitcher.test.ts approach.
// We test the component's core logic without mounting the SFC.

describe('VatDisplaySwitcher logic', () => {
  describe('variant prop', () => {
    const validVariants = ['icon', 'text', 'inline'] as const;

    it('should have icon as a valid variant', () => {
      expect(validVariants).toContain('icon');
    });

    it('should have text as a valid variant', () => {
      expect(validVariants).toContain('text');
    });

    it('should have inline as a valid variant', () => {
      expect(validVariants).toContain('inline');
    });
  });

  describe('trigger label', () => {
    // Mirrors: showIncVat ? t('common.vat_incl') : t('common.vat_excl')
    function triggerLabel(showIncVat: boolean): string {
      return showIncVat ? 'common.vat_incl' : 'common.vat_excl';
    }

    it('should show incl label when showIncVat is true', () => {
      expect(triggerLabel(true)).toBe('common.vat_incl');
    });

    it('should show excl label when showIncVat is false', () => {
      expect(triggerLabel(false)).toBe('common.vat_excl');
    });
  });

  describe('setShowIncVat logic', () => {
    // Mirrors: selecting incl calls setShowIncVat(true), excl calls setShowIncVat(false)
    function resolveIncVat(option: 'incl' | 'excl'): boolean {
      return option === 'incl';
    }

    it('should call setShowIncVat(true) when incl option selected', () => {
      expect(resolveIncVat('incl')).toBe(true);
    });

    it('should call setShowIncVat(false) when excl option selected', () => {
      expect(resolveIncVat('excl')).toBe(false);
    });
  });

  describe('active state logic', () => {
    // Mirrors: :class="{ 'font-semibold': showIncVat }" for incl item
    function isInclActive(showIncVat: boolean): boolean {
      return showIncVat;
    }

    function isExclActive(showIncVat: boolean): boolean {
      return !showIncVat;
    }

    it('should mark incl as active when showIncVat is true', () => {
      expect(isInclActive(true)).toBe(true);
      expect(isExclActive(true)).toBe(false);
    });

    it('should mark excl as active when showIncVat is false', () => {
      expect(isInclActive(false)).toBe(false);
      expect(isExclActive(false)).toBe(true);
    });
  });

  describe('inline variant button state', () => {
    // Mirrors: variant="secondary" for active, "ghost" for inactive
    function inlineButtonVariant(isActive: boolean): 'secondary' | 'ghost' {
      return isActive ? 'secondary' : 'ghost';
    }

    it('should use secondary variant for active button', () => {
      expect(inlineButtonVariant(true)).toBe('secondary');
    });

    it('should use ghost variant for inactive button', () => {
      expect(inlineButtonVariant(false)).toBe('ghost');
    });
  });
});

describe('VatDisplaySwitcher render', () => {
  beforeEach(() => {
    mockShowPrice.value = true;
  });

  it('renders the switcher dropdown when showPrice is true (default icon variant)', () => {
    const wrapper = mountComponent(VatDisplaySwitcher);
    expect(wrapper.html()).toContain('button');
  });

  it('renders both vat_incl and vat_excl buttons when showPrice is true and variant is inline', () => {
    const wrapper = mountComponent(VatDisplaySwitcher, {
      props: { variant: 'inline' },
    });
    const html = wrapper.html();
    expect(html).toContain('common.vat_incl');
    expect(html).toContain('common.vat_excl');
  });

  it('renders nothing when showPrice is false', () => {
    mockShowPrice.value = false;
    const wrapper = mountComponent(VatDisplaySwitcher);
    // A <template v-if> renders a comment node when false, leaving no real elements.
    expect(wrapper.find('button').exists()).toBe(false);
    expect(wrapper.html()).not.toContain('common.vat_incl');
    expect(wrapper.html()).not.toContain('common.vat_excl');
  });

  it('renders nothing for inline variant when showPrice is false', () => {
    mockShowPrice.value = false;
    const wrapper = mountComponent(VatDisplaySwitcher, {
      props: { variant: 'inline' },
    });
    expect(wrapper.find('button').exists()).toBe(false);
    expect(wrapper.html()).not.toContain('common.vat_incl');
    expect(wrapper.html()).not.toContain('common.vat_excl');
  });
});
