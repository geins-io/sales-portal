import { describe, it, expect } from 'vitest';
import {
  tenantIdKey,
  tenantConfigKey,
  createDefaultTheme,
  generateTenantCss,
  generateThemeHash,
} from '../../server/utils/tenant';
import { KV_STORAGE_KEYS } from '../../shared/constants/storage';

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
});
