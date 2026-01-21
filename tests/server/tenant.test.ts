import { describe, it, expect } from 'vitest';
import {
  tenantIdKey,
  tenantConfigKey,
  createDefaultTheme,
  generateTenantCss,
  generateThemeHash,
  mergeThemes,
} from '../../server/utils/tenant';
import { KV_STORAGE_KEYS } from '../../shared/constants/storage';
import type { TenantTheme } from '../../shared/types/tenant-config';

describe('Tenant utilities', () => {
  describe('tenantIdKey', () => {
    it('should generate correct key for hostname', () => {
      const key = tenantIdKey('example.com');
      expect(key).toBe(`${KV_STORAGE_KEYS.TENANT_ID_PREFIX}example.com`);
    });

    it('should handle localhost', () => {
      const key = tenantIdKey('localhost');
      expect(key).toBe(`${KV_STORAGE_KEYS.TENANT_ID_PREFIX}localhost`);
    });
  });

  describe('tenantConfigKey', () => {
    it('should generate correct key for tenant ID', () => {
      const key = tenantConfigKey('tenant-123');
      expect(key).toBe(`${KV_STORAGE_KEYS.TENANT_CONFIG_PREFIX}tenant-123`);
    });
  });

  describe('createDefaultTheme', () => {
    it('should create theme with correct name', () => {
      const theme = createDefaultTheme('my-tenant');
      expect(theme.name).toBe('my-tenant');
      expect(theme.displayName).toBe('my-tenant');
    });

    it('should include default colors', () => {
      const theme = createDefaultTheme('test');
      expect(theme.colors).toBeDefined();
      expect(theme.colors.primary).toBeDefined();
      expect(theme.colors.secondary).toBeDefined();
      expect(theme.colors.background).toBeDefined();
    });

    it('should include border radius', () => {
      const theme = createDefaultTheme('test');
      expect(theme.borderRadius).toBeDefined();
      expect(theme.borderRadius?.base).toBe('0.625rem');
    });
  });

  describe('generateTenantCss', () => {
    it('should generate CSS with data-theme selector', () => {
      const theme = createDefaultTheme('my-tenant');
      const css = generateTenantCss(theme);
      expect(css).toContain("[data-theme='my-tenant']");
    });

    it('should include primary color variable', () => {
      const theme = createDefaultTheme('test');
      const css = generateTenantCss(theme);
      expect(css).toContain('--primary:');
    });

    it('should include custom border radius', () => {
      const theme = createDefaultTheme('test');
      theme.borderRadius = { base: '1rem' };
      const css = generateTenantCss(theme);
      expect(css).toContain('--radius: 1rem');
    });

    it('should include custom properties', () => {
      const theme = createDefaultTheme('test');
      theme.customProperties = {
        '--custom-var': 'custom-value',
      };
      const css = generateTenantCss(theme);
      expect(css).toContain('--custom-var: custom-value');
    });
  });

  describe('generateThemeHash', () => {
    it('should generate a consistent hash for the same theme', () => {
      const theme = createDefaultTheme('test');
      const hash1 = generateThemeHash(theme);
      const hash2 = generateThemeHash(theme);
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different themes', () => {
      const theme1 = createDefaultTheme('test1');
      const theme2 = createDefaultTheme('test2');
      const hash1 = generateThemeHash(theme1);
      const hash2 = generateThemeHash(theme2);
      expect(hash1).not.toBe(hash2);
    });

    it('should detect color changes', () => {
      const theme1 = createDefaultTheme('test');
      const theme2 = createDefaultTheme('test');
      theme2.colors.primary = 'oklch(0.5 0.1 200)';
      const hash1 = generateThemeHash(theme1);
      const hash2 = generateThemeHash(theme2);
      expect(hash1).not.toBe(hash2);
    });

    it('should detect border radius changes', () => {
      const theme1 = createDefaultTheme('test');
      const theme2 = createDefaultTheme('test');
      theme2.borderRadius = { base: '1rem' };
      const hash1 = generateThemeHash(theme1);
      const hash2 = generateThemeHash(theme2);
      expect(hash1).not.toBe(hash2);
    });

    it('should detect custom property changes', () => {
      const theme1 = createDefaultTheme('test');
      theme1.customProperties = { '--custom': 'value1' };
      const theme2 = createDefaultTheme('test');
      theme2.customProperties = { '--custom': 'value2' };
      const hash1 = generateThemeHash(theme1);
      const hash2 = generateThemeHash(theme2);
      expect(hash1).not.toBe(hash2);
    });

    it('should return a string hash', () => {
      const theme = createDefaultTheme('test');
      const hash = generateThemeHash(theme);
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('mergeThemes', () => {
    it('should return base theme when updates is undefined', () => {
      const base = createDefaultTheme('test');
      const result = mergeThemes(base, undefined);
      expect(result).toBe(base);
    });

    it('should merge top-level theme properties', () => {
      const base = createDefaultTheme('test');
      const updates: Partial<TenantTheme> = {
        name: 'updated-name',
        displayName: 'Updated Display Name',
      };
      const result = mergeThemes(base, updates);
      expect(result.name).toBe('updated-name');
      expect(result.displayName).toBe('Updated Display Name');
    });

    it('should deep merge colors', () => {
      const base = createDefaultTheme('test');
      const updates: Partial<TenantTheme> = {
        colors: {
          primary: 'oklch(0.5 0.2 200)',
          secondary: 'oklch(0.6 0.1 100)',
        },
      };
      const result = mergeThemes(base, updates);
      expect(result.colors.primary).toBe('oklch(0.5 0.2 200)');
      expect(result.colors.secondary).toBe('oklch(0.6 0.1 100)');
      // Ensure other default colors are preserved
      expect(result.colors.background).toBe(base.colors.background);
      expect(result.colors.foreground).toBe(base.colors.foreground);
    });

    it('should deep merge borderRadius', () => {
      const base = createDefaultTheme('test');
      const updates: Partial<TenantTheme> = {
        borderRadius: {
          sm: '0.25rem',
          lg: '1rem',
        },
      };
      const result = mergeThemes(base, updates);
      expect(result.borderRadius?.sm).toBe('0.25rem');
      expect(result.borderRadius?.lg).toBe('1rem');
      // Ensure base borderRadius is preserved
      expect(result.borderRadius?.base).toBe('0.625rem');
    });

    it('should deep merge typography', () => {
      const base: TenantTheme = {
        ...createDefaultTheme('test'),
        typography: {
          fontFamily: 'Arial',
          baseFontSize: '16px',
        },
      };
      const updates: Partial<TenantTheme> = {
        typography: {
          headingFontFamily: 'Georgia',
        },
      };
      const result = mergeThemes(base, updates);
      expect(result.typography?.fontFamily).toBe('Arial');
      expect(result.typography?.baseFontSize).toBe('16px');
      expect(result.typography?.headingFontFamily).toBe('Georgia');
    });

    it('should deep merge customProperties', () => {
      const base: TenantTheme = {
        ...createDefaultTheme('test'),
        customProperties: {
          '--custom-spacing': '1rem',
          '--custom-shadow': '0 2px 4px rgba(0,0,0,0.1)',
        },
      };
      const updates: Partial<TenantTheme> = {
        customProperties: {
          '--custom-shadow': '0 4px 8px rgba(0,0,0,0.2)',
          '--new-property': 'value',
        },
      };
      const result = mergeThemes(base, updates);
      expect(result.customProperties?.['--custom-spacing']).toBe('1rem');
      expect(result.customProperties?.['--custom-shadow']).toBe(
        '0 4px 8px rgba(0,0,0,0.2)',
      );
      expect(result.customProperties?.['--new-property']).toBe('value');
    });

    it('should handle empty updates object', () => {
      const base = createDefaultTheme('test');
      const updates: Partial<TenantTheme> = {};
      const result = mergeThemes(base, updates);
      // Should be a new object with same properties
      expect(result).not.toBe(base);
      expect(result.name).toBe(base.name);
      expect(result.colors.primary).toBe(base.colors.primary);
    });

    it('should preserve base properties when not in updates', () => {
      const base = createDefaultTheme('test');
      const updates: Partial<TenantTheme> = {
        displayName: 'New Display Name',
      };
      const result = mergeThemes(base, updates);
      expect(result.name).toBe(base.name);
      expect(result.displayName).toBe('New Display Name');
      expect(result.colors).toEqual(base.colors);
      expect(result.borderRadius).toEqual(base.borderRadius);
    });
  });
});
