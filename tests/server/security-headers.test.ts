import { describe, it, expect, vi } from 'vitest';

/**
 * Verify that the nuxt-security module is correctly configured in nuxt.config.ts.
 * These are config-level tests that assert the security configuration shape
 * rather than making HTTP requests.
 */

// Mock defineNuxtConfig to pass-through the config object
vi.stubGlobal('defineNuxtConfig', (config: Record<string, unknown>) => config);

// Dynamic import after the mock is in place
const { default: nuxtConfig } =
  (await import('../../nuxt.config')) as unknown as {
    default: Record<string, unknown>;
  };

const security = nuxtConfig.security as Record<string, unknown>;
const headers = security.headers as Record<string, unknown>;
const csp = headers.contentSecurityPolicy as Record<string, string[]>;

describe('nuxt-security configuration', () => {
  it('includes nuxt-security in modules', () => {
    const modules = nuxtConfig.modules as string[];
    expect(modules).toContain('nuxt-security');
  });

  it('has security config defined', () => {
    expect(security).toBeDefined();
    expect(typeof security).toBe('object');
  });

  describe('Content-Security-Policy directives', () => {
    it('sets default-src to self', () => {
      expect(csp['default-src']).toEqual(["'self'"]);
    });

    it('allows Google Tag Manager and Analytics in script-src', () => {
      expect(csp['script-src']).toContain("'self'");
      expect(csp['script-src']).toContain('https://www.googletagmanager.com');
      expect(csp['script-src']).toContain('https://www.google-analytics.com');
    });

    it('allows unsafe-inline in style-src for tenant CSS injection', () => {
      expect(csp['style-src']).toContain("'unsafe-inline'");
      expect(csp['style-src']).toContain('https://fonts.googleapis.com');
    });

    it('allows Google Fonts in font-src', () => {
      expect(csp['font-src']).toContain("'self'");
      expect(csp['font-src']).toContain('https://fonts.gstatic.com');
    });

    it('allows data URIs and https in img-src', () => {
      expect(csp['img-src']).toContain("'self'");
      expect(csp['img-src']).toContain('data:');
      expect(csp['img-src']).toContain('https:');
    });

    it('allows Geins API, Sentry, and GA in connect-src', () => {
      expect(csp['connect-src']).toContain("'self'");
      expect(csp['connect-src']).toContain('https://merchantapi.geins.io');
      expect(csp['connect-src']).toContain('https://*.sentry.io');
      expect(csp['connect-src']).toContain('https://www.google-analytics.com');
    });

    it('disallows framing with frame-ancestors none', () => {
      expect(csp['frame-ancestors']).toEqual(["'none'"]);
    });

    it('restricts base-uri to self', () => {
      expect(csp['base-uri']).toEqual(["'self'"]);
    });

    it('restricts form-action to self', () => {
      expect(csp['form-action']).toEqual(["'self'"]);
    });
  });

  describe('other security headers', () => {
    it('sets X-Content-Type-Options to nosniff', () => {
      expect(headers.xContentTypeOptions).toBe('nosniff');
    });

    it('sets X-Frame-Options to DENY', () => {
      expect(headers.xFrameOptions).toBe('DENY');
    });

    it('sets Referrer-Policy to strict-origin-when-cross-origin', () => {
      expect(headers.referrerPolicy).toBe('strict-origin-when-cross-origin');
    });

    it('disables Cross-Origin-Embedder-Policy', () => {
      expect(headers.crossOriginEmbedderPolicy).toBe(false);
    });
  });

  describe('disabled features', () => {
    it('disables rate limiter (handled by custom middleware)', () => {
      expect(security.rateLimiter).toBe(false);
    });

    it('disables request size limiter', () => {
      expect(security.requestSizeLimiter).toBe(false);
    });

    it('disables XSS validator', () => {
      expect(security.xssValidator).toBe(false);
    });

    it('disables CORS handler', () => {
      expect(security.corsHandler).toBe(false);
    });
  });
});
