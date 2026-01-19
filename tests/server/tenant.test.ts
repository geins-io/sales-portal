import { describe, it, expect } from 'vitest';
import {
  tenantIdKey,
  tenantConfigKey,
  createDefaultTheme,
  generateTenantCss,
} from '../../server/utils/tenant';

describe('Tenant utilities', () => {
  describe('tenantIdKey', () => {
    it('should generate correct key for hostname', () => {
      const key = tenantIdKey('example.com');
      expect(key).toBe('tenant:id:example.com');
    });

    it('should handle localhost', () => {
      const key = tenantIdKey('localhost');
      expect(key).toBe('tenant:id:localhost');
    });
  });

  describe('tenantConfigKey', () => {
    it('should generate correct key for tenant ID', () => {
      const key = tenantConfigKey('tenant-123');
      expect(key).toBe('tenant:config:tenant-123');
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

    it('should include dark mode colors', () => {
      const theme = createDefaultTheme('test');
      expect(theme.darkColors).toBeDefined();
      expect(theme.darkColors?.primary).toBeDefined();
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

    it('should generate dark mode styles when darkColors provided', () => {
      const theme = createDefaultTheme('test');
      const css = generateTenantCss(theme);
      expect(css).toContain('.dark');
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
});
