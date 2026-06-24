import { describe, it, expect } from 'vitest';

import {
  STOREFRONT_SETTINGS_DEFAULTS,
  mergeStorefrontSettings,
} from '../../server/utils/storefront-settings-defaults';
import type { StoreSettings } from '../../server/schemas/store-settings';

describe('storefront-settings-defaults', () => {
  describe('STOREFRONT_SETTINGS_DEFAULTS', () => {
    it('coerces color defaults to OKLCH at module load', () => {
      for (const value of Object.values(
        STOREFRONT_SETTINGS_DEFAULTS.theme.colors,
      )) {
        expect(value).toMatch(/^oklch\(/);
      }
    });

    it('coerces hex case-insensitively (mixed-case yields same OKLCH)', () => {
      // siteBackground is `#FAFAFA` in source. Treat as opaque grey near
      // white; the value must round-trip through OKLCH the same as
      // `#fafafa` would.
      expect(STOREFRONT_SETTINGS_DEFAULTS.theme.colors.siteBackground).toMatch(
        /^oklch\(/,
      );
    });

    it('defaults the Studio-managed flags (priceVisibility, orderPlacement, stockStatus) to enabled:false', () => {
      expect(STOREFRONT_SETTINGS_DEFAULTS.features.priceVisibility).toEqual({
        enabled: false,
        access: 'authenticated',
      });
      expect(STOREFRONT_SETTINGS_DEFAULTS.features.orderPlacement).toEqual({
        enabled: false,
        access: 'authenticated',
      });
      expect(STOREFRONT_SETTINGS_DEFAULTS.features.stockStatus).toEqual({
        enabled: false,
        access: 'authenticated',
      });
    });

    it('defaults baseline storefront flags (cart, checkout, lists, wishlist, etc.) to enabled:true', () => {
      for (const key of [
        'analytics',
        'applyForAccount',
        'cart',
        'checkout',
        'lists',
        'newsletterSignup',
        'orderHistory',
        'quotes',
        'registration',
        'reorder',
        'wishlist',
      ] as const) {
        expect(STOREFRONT_SETTINGS_DEFAULTS.features[key]?.enabled).toBe(true);
      }
    });

    it('defaults seo.robots to "index, follow"', () => {
      expect(STOREFRONT_SETTINGS_DEFAULTS.seo.robots).toBe('index, follow');
    });

    it('defaults mode to "commerce" and radius to "0"', () => {
      expect(STOREFRONT_SETTINGS_DEFAULTS.mode).toBe('commerce');
      expect(STOREFRONT_SETTINGS_DEFAULTS.theme.radius).toBe('0');
    });
  });

  describe('mergeStorefrontSettings', () => {
    it('empty input yields the canonical defaults (Studio-managed flags off, baseline flags on)', () => {
      const merged = mergeStorefrontSettings({});
      expect(merged.mode).toBe('commerce');
      expect(merged.theme.radius).toBe('0');
      expect(merged.features.stockStatus).toEqual({
        enabled: false,
        access: 'authenticated',
      });
      expect(merged.features.priceVisibility).toEqual({
        enabled: false,
        access: 'authenticated',
      });
      expect(merged.features.orderPlacement).toEqual({
        enabled: false,
        access: 'authenticated',
      });
      expect(merged.features.cart?.enabled).toBe(true);
      expect(merged.features.checkout?.enabled).toBe(true);
      expect(merged.seo?.robots).toBe('index, follow');
    });

    it('explicit enabled:true from the API overrides the default-off for Studio-managed flags', () => {
      const merged = mergeStorefrontSettings({
        features: {
          stockStatus: { enabled: true, access: 'authenticated' },
        },
      });
      expect(merged.features.stockStatus).toEqual({
        enabled: true,
        access: 'authenticated',
      });
      // Siblings still fall back to the canonical defaults
      expect(merged.features.priceVisibility).toEqual({
        enabled: false,
        access: 'authenticated',
      });
      expect(merged.features.orderPlacement).toEqual({
        enabled: false,
        access: 'authenticated',
      });
    });

    it('partial features preserves api keys and fills missing siblings', () => {
      const merged = mergeStorefrontSettings({
        features: {
          priceVisibility: { enabled: false, access: 'authenticated' },
        },
      });
      expect(merged.features.priceVisibility).toEqual({
        enabled: false,
        access: 'authenticated',
      });
      expect(merged.features.stockStatus).toEqual({
        enabled: false,
        access: 'authenticated',
      });
      expect(merged.features.orderPlacement).toEqual({
        enabled: false,
        access: 'authenticated',
      });
    });

    it('partial nested theme.colors fills only missing sibling colors', () => {
      const merged = mergeStorefrontSettings({
        theme: {
          colors: {
            siteBackground: 'oklch(0 0 0)',
          },
        } as StoreSettings['theme'],
      });
      expect(merged.theme.colors.siteBackground).toBe('oklch(0 0 0)');
      // Other siblings come from defaults (OKLCH strings).
      expect(merged.theme.colors.navBarBackground).toMatch(/^oklch\(/);
      expect(merged.theme.colors.buttonBackground).toMatch(/^oklch\(/);
    });

    it('explicit empty string is honored over a "" default', () => {
      const merged = mergeStorefrontSettings({
        branding: {
          name: 'X',
          watermark: 'full',
          logoUrl: '',
        } as StoreSettings['branding'],
      });
      expect(merged.branding.logoUrl).toBe('');
    });

    it('explicit false is honored over a default with enabled:false', () => {
      const merged = mergeStorefrontSettings({
        features: {
          stockStatus: { enabled: true, access: 'authenticated' },
        },
      });
      expect(merged.features.stockStatus?.enabled).toBe(true);
    });

    it('undefined in api skips fallback', () => {
      const merged = mergeStorefrontSettings({
        mode: undefined,
      } as Partial<StoreSettings>);
      expect(merged.mode).toBe('commerce');
    });

    it('arrays replace, never concat', () => {
      const merged = mergeStorefrontSettings({
        aliases: ['b.com'],
      });
      expect(merged.aliases).toEqual(['b.com']);

      // Parallel fixture proving array-replace semantics on a known array key.
      const mergedKw = mergeStorefrontSettings({
        seo: {
          defaultKeywords: ['only-this'],
        } as StoreSettings['seo'],
      });
      expect(mergedKw.seo?.defaultKeywords).toEqual(['only-this']);
    });
  });
});
