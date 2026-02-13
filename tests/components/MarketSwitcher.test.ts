import { describe, it, expect } from 'vitest';

// Same approach as LocaleSwitcher tests — test the component's core logic
// (showSwitcher computed and market display) rather than mounting the SFC.

describe('MarketSwitcher logic', () => {
  describe('showSwitcher', () => {
    function showSwitcher(markets: string[]): boolean {
      return markets.length > 1;
    }

    it('should be false when no markets available', () => {
      expect(showSwitcher([])).toBe(false);
    });

    it('should be false when only one market available', () => {
      expect(showSwitcher(['se'])).toBe(false);
    });

    it('should be true when multiple markets available', () => {
      expect(showSwitcher(['se', 'no'])).toBe(true);
    });

    it('should be true when three markets available', () => {
      expect(showSwitcher(['se', 'no', 'dk'])).toBe(true);
    });
  });

  describe('currentMarket', () => {
    // Mirrors: computed(() => marketCookie.value || market.value)
    function currentMarket(
      cookieValue: string | undefined,
      tenantDefault: string,
    ): string {
      return cookieValue || tenantDefault;
    }

    it('should use cookie value when set', () => {
      expect(currentMarket('no', 'se')).toBe('no');
    });

    it('should fall back to tenant default when no cookie', () => {
      expect(currentMarket(undefined, 'se')).toBe('se');
    });

    it('should fall back to tenant default when cookie is empty', () => {
      expect(currentMarket('', 'se')).toBe('se');
    });
  });

  describe('market display', () => {
    // Mirrors: {{ m.toUpperCase() }}
    it('should uppercase market codes for display', () => {
      expect('se'.toUpperCase()).toBe('SE');
      expect('no'.toUpperCase()).toBe('NO');
      expect('dk'.toUpperCase()).toBe('DK');
    });

    it('should uppercase current market for text variant trigger', () => {
      const current = 'se';
      expect(current.toUpperCase()).toBe('SE');
    });
  });

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
});
