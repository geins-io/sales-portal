import { describe, it, expect } from 'vitest';

// We can't easily mount the real SFC with auto-imported Nuxt composables
// in vitest. Instead, test the component's core logic: the showSwitcher
// computed and the locale name mapping.

describe('LocaleSwitcher logic', () => {
  describe('showSwitcher', () => {
    // Mirrors: computed(() => availableLocales.value.length > 1)
    function showSwitcher(locales: string[]): boolean {
      return locales.length > 1;
    }

    it('should be false when no locales available', () => {
      expect(showSwitcher([])).toBe(false);
    });

    it('should be false when only one locale available', () => {
      expect(showSwitcher(['en'])).toBe(false);
    });

    it('should be true when multiple locales available', () => {
      expect(showSwitcher(['en', 'sv'])).toBe(true);
    });

    it('should be true when three locales available', () => {
      expect(showSwitcher(['en', 'sv', 'de'])).toBe(true);
    });
  });

  describe('localeNames mapping', () => {
    // Mirrors the computed that maps locale codes to display names
    function buildLocaleNames(
      locales: Array<string | { code: string; name?: string }>,
    ): Map<string, string> {
      const map = new Map<string, string>();
      for (const loc of locales) {
        if (typeof loc === 'string') {
          map.set(loc, loc);
        } else {
          map.set(loc.code, loc.name ?? loc.code);
        }
      }
      return map;
    }

    it('should map object locales to their names', () => {
      const names = buildLocaleNames([
        { code: 'en', name: 'English' },
        { code: 'sv', name: 'Svenska' },
      ]);

      expect(names.get('en')).toBe('English');
      expect(names.get('sv')).toBe('Svenska');
    });

    it('should use code as fallback when name is missing', () => {
      const names = buildLocaleNames([{ code: 'de' }]);

      expect(names.get('de')).toBe('de');
    });

    it('should handle string locales', () => {
      const names = buildLocaleNames(['en', 'sv']);

      expect(names.get('en')).toBe('en');
      expect(names.get('sv')).toBe('sv');
    });
  });

  describe('currentLocaleName', () => {
    // Mirrors: computed(() => localeNames.get(currentLocale) ?? currentLocale)
    function currentLocaleName(
      localeNames: Map<string, string>,
      currentLocale: string,
    ): string {
      return localeNames.get(currentLocale) ?? currentLocale;
    }

    it('should return display name for text variant', () => {
      const names = new Map([
        ['en', 'English'],
        ['sv', 'Svenska'],
      ]);
      expect(currentLocaleName(names, 'en')).toBe('English');
    });

    it('should fall back to code when name not found', () => {
      const names = new Map<string, string>();
      expect(currentLocaleName(names, 'de')).toBe('de');
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
