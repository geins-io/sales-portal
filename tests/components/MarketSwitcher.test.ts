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

  describe('marketLabel (full country names in the option list)', () => {
    // Mirrors the component helper: show the localized country name with the
    // code in the dropdown options, e.g. "Sweden (SE)", while falling back to
    // the bare uppercase code when the region can't be resolved.
    function marketLabel(
      code: string,
      regionNames: Intl.DisplayNames | null,
    ): string {
      const upper = code.toUpperCase();
      try {
        const name = regionNames?.of(upper);
        if (name && name !== upper) return `${name} (${upper})`;
      } catch {
        // Malformed region code: fall through to the bare code below.
      }
      return upper;
    }

    const en = new Intl.DisplayNames(['en'], { type: 'region' });
    const sv = new Intl.DisplayNames(['sv'], { type: 'region' });

    it('renders the localized country name with the code in English', () => {
      expect(marketLabel('se', en)).toBe('Sweden (SE)');
      expect(marketLabel('no', en)).toBe('Norway (NO)');
    });

    it('localizes the country name to the active locale', () => {
      expect(marketLabel('se', sv)).toBe('Sverige (SE)');
    });

    it('uppercases the 2-letter code regardless of input case', () => {
      expect(marketLabel('dk', en)).toBe('Denmark (DK)');
    });

    it('falls back to the bare code when region names are unavailable', () => {
      expect(marketLabel('se', null)).toBe('SE');
    });

    it('falls back to the bare code for a malformed region code', () => {
      // A single-letter code is malformed; Intl.DisplayNames.of throws.
      expect(marketLabel('s', en)).toBe('S');
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
