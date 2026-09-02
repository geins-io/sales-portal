import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { orderLocalesByName } from '../../app/utils/order-locales';

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

  describe('localeHref', () => {
    // Mirrors the logic: alternates-first (carrying the live query), then the
    // clean-path fallback (which already includes the query via cleanPath).
    //   const alt = hrefFor(loc);
    //   if (alt) { const q = fullPath.indexOf('?');
    //     return q >= 0 ? alt + fullPath.slice(q) : alt; }
    //   return `/${market}/${loc}${cleanPath}`;
    function localeHref(
      market: string,
      loc: string,
      cleanPath: string,
      hrefFor: (loc: string) => string | undefined,
      fullPath = '',
    ): string {
      const alt = hrefFor(loc);
      if (alt) {
        const q = fullPath.indexOf('?');
        return q >= 0 ? alt + fullPath.slice(q) : alt;
      }
      return `/${market}/${loc}${cleanPath}`;
    }

    // Fallback helper: no published alternate for any locale.
    const noAlternate = () => undefined;

    it('uses the published alternate when present', () => {
      const hrefFor = (loc: string) =>
        loc === 'en' ? '/se/en/p/material/cutting-edge' : undefined;
      const result = localeHref('se', 'en', '/p/material/skarkant', hrefFor);
      expect(result).toBe('/se/en/p/material/cutting-edge');
      // The published alternate must NOT carry the current SV slug.
      expect(result).not.toContain('skarkant');
    });

    it('falls back to clean-path when no alternate for the target locale', () => {
      expect(localeHref('se', 'en', '/p/material/skarkant', noAlternate)).toBe(
        '/se/en/p/material/skarkant',
      );
    });

    it('preserves the alias on a PDP path (fallback branch)', () => {
      expect(
        localeHref(
          'se',
          'en',
          '/p/material/anborrningsgrenar/anborrningsgrenror-o-50-rf',
          noAlternate,
        ),
      ).toBe('/se/en/p/material/anborrningsgrenar/anborrningsgrenror-o-50-rf');
    });

    it('preserves the alias on a category path (fallback branch)', () => {
      expect(localeHref('se', 'en', '/l/kategori-1', noAlternate)).toBe(
        '/se/en/l/kategori-1',
      );
    });

    it('emits /market/locale/ when the clean path is / (fallback branch)', () => {
      expect(localeHref('se', 'en', '/', noAlternate)).toBe('/se/en/');
    });

    it('keeps query strings on the destination URL (fallback branch)', () => {
      expect(localeHref('se', 'en', '/l/kategori-1?page=2', noAlternate)).toBe(
        '/se/en/l/kategori-1?page=2',
      );
    });

    it('cross-locale switch lands on the correct target slug', () => {
      // Regression: on the SV slug `skarkant`, switching to EN must
      // resolve to the published EN slug `cutting-edge`, never the SV slug.
      const hrefFor = (loc: string) =>
        loc === 'en' ? '/se/en/p/material/cutting-edge' : undefined;
      const result = localeHref('se', 'en', '/p/material/skarkant', hrefFor);
      expect(result).toContain('cutting-edge');
      expect(result).not.toContain('skarkant');
    });

    it('carries the active query onto the published alternate (sort/filter/page kept)', () => {
      const hrefFor = (loc: string) =>
        loc === 'en' ? '/se/en/c/categoryone' : undefined;
      const result = localeHref(
        'se',
        'en',
        '/c/kategorin',
        hrefFor,
        '/se/sv/c/kategorin?sort=newest&color=red&page=2',
      );
      expect(result).toBe('/se/en/c/categoryone?sort=newest&color=red&page=2');
    });

    it('emits a bare alternate when there is no active query (no trailing ?)', () => {
      const hrefFor = (loc: string) =>
        loc === 'en' ? '/se/en/c/categoryone' : undefined;
      expect(
        localeHref('se', 'en', '/c/kategorin', hrefFor, '/se/sv/c/kategorin'),
      ).toBe('/se/en/c/categoryone');
    });
  });

  describe('orderedLocales', () => {
    // The real switcher's name map, read from nuxt.config.ts so a sixth
    // language is covered without editing this file. Parsed rather than
    // imported: `defineNuxtConfig` is an auto-import vitest has no context
    // for. Same approach as tests/e2e/locale-switching.spec.ts.
    function configuredEndonyms(): Map<string, string> {
      const source = readFileSync(
        resolve(import.meta.dirname, '../../nuxt.config.ts'),
        'utf8',
      );
      const entry =
        /\{\s*code:\s*'([^']+)',\s*language:\s*'[^']+',\s*name:\s*'([^']*)',\s*file:\s*'[^']+'\s*\}/g;
      const map = new Map(
        [...source.matchAll(entry)].map((m) => [m[1]!, m[2]!] as const),
      );
      if (map.size === 0) {
        throw new Error(
          'Could not parse any i18n locales out of nuxt.config.ts. The ' +
            'locales array shape changed — update the regex here, do not ' +
            'delete the assertion.',
        );
      }
      return map;
    }

    const ENDONYMS = configuredEndonyms();
    const CODES = [...ENDONYMS.keys()];

    it('orders every configured locale alphabetically by endonym', () => {
      const expected = [...ENDONYMS.entries()]
        .sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
        .map(([code]) => code);

      expect(orderLocalesByName(CODES, ENDONYMS)).toEqual(expected);
    });

    it('does not simply return the config order', () => {
      // Guards the assertion above from passing vacuously.
      expect(orderLocalesByName(CODES, ENDONYMS)).not.toEqual(CODES);
    });

    it('sorts on the endonym rather than the locale code', () => {
      expect(orderLocalesByName(['fi', 'nb'], ENDONYMS)).toEqual(['nb', 'fi']);
    });

    it('is stable regardless of the incoming order', () => {
      const expected = orderLocalesByName(CODES, ENDONYMS);
      expect(orderLocalesByName([...CODES].reverse(), ENDONYMS)).toEqual(
        expected,
      );
      expect(orderLocalesByName([...CODES].sort(), ENDONYMS)).toEqual(expected);
    });

    it('never renders a locale the tenant does not offer', () => {
      const order = orderLocalesByName(['sv', 'da', 'en'], ENDONYMS);
      expect(order).toEqual(['da', 'en', 'sv']);
      expect(order).not.toContain('nb');
      expect(order).not.toContain('fi');
    });

    it('does not put the current or default locale first', () => {
      expect(orderLocalesByName(['sv', 'en', 'da'], ENDONYMS)[0]).toBe('da');
    });

    it('falls back to the code for a locale with no configured name', () => {
      const names = new Map([
        ['en', 'English'],
        ['sv', 'Svenska'],
      ]);
      expect(orderLocalesByName(['sv', 'de', 'en'], names)).toEqual([
        'de',
        'en',
        'sv',
      ]);
    });

    it('does not mutate the tenant locale array', () => {
      const tenantLocales = ['sv', 'en', 'da'];
      orderLocalesByName(tenantLocales, ENDONYMS);
      expect(tenantLocales).toEqual(['sv', 'en', 'da']);
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

describe('LocaleSwitcher trigger abbreviation', () => {
  // Mirrors: computed(() => currentLocale.value.toUpperCase())
  function currentLocaleAbbr(locale: string): string {
    return locale.toUpperCase();
  }

  it('shows the uppercased locale code in the trigger, not the full name', () => {
    expect(currentLocaleAbbr('sv')).toBe('SV');
    expect(currentLocaleAbbr('en')).toBe('EN');
  });

  it('is independent of the display-name map (full names stay in the dropdown)', () => {
    // "Svenska"/"English" are the dropdown item labels; the trigger is the abbr.
    expect(currentLocaleAbbr('sv')).not.toBe('Svenska');
  });
});
