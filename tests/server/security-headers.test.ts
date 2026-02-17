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
const csp = headers.contentSecurityPolicy as Record<string, string[] | boolean>;

describe('nuxt-security configuration', () => {
  it('includes nuxt-security in modules', () => {
    const modules = nuxtConfig.modules as string[];
    expect(modules).toContain('nuxt-security');
  });

  it('has security config defined', () => {
    expect(security).toBeDefined();
    expect(typeof security).toBe('object');
  });

  it('enables nonce support for SSR', () => {
    expect(security.nonce).toBe(true);
  });

  it('enables SRI (Subresource Integrity)', () => {
    expect(security.sri).toBe(true);
  });

  describe('Content-Security-Policy directives', () => {
    it('sets default-src to none (strict mode)', () => {
      expect(csp['default-src']).toEqual(["'none'"]);
    });

    it('uses strict-dynamic with nonce for script-src', () => {
      const scriptSrc = csp['script-src'] as string[];
      expect(scriptSrc).toContain("'self'");
      expect(scriptSrc).toContain("'strict-dynamic'");
      expect(scriptSrc).toContain("'nonce-{{nonce}}'");
    });

    it('uses nonce for style-src with Google Fonts', () => {
      const styleSrc = csp['style-src'] as string[];
      expect(styleSrc).toContain("'self'");
      expect(styleSrc).toContain("'nonce-{{nonce}}'");
      expect(styleSrc).toContain('https://fonts.googleapis.com');
      expect(styleSrc).not.toContain("'unsafe-inline'");
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

    it('allows Geins API, Sentry, GTM, and GA in connect-src', () => {
      const connectSrc = csp['connect-src'] as string[];
      expect(connectSrc).toContain("'self'");
      expect(connectSrc).toContain('https://merchantapi.geins.io');
      expect(connectSrc).toContain('https://*.sentry.io');
      expect(connectSrc).toContain('https://www.google-analytics.com');
      expect(connectSrc).toContain('https://www.googletagmanager.com');
    });

    it('disallows framing with frame-ancestors none', () => {
      expect(csp['frame-ancestors']).toEqual(["'none'"]);
    });

    it('restricts base-uri to none', () => {
      expect(csp['base-uri']).toEqual(["'none'"]);
    });

    it('restricts form-action to self', () => {
      expect(csp['form-action']).toEqual(["'self'"]);
    });

    it('blocks object embeds', () => {
      expect(csp['object-src']).toEqual(["'none'"]);
    });

    it('blocks inline event handlers', () => {
      expect(csp['script-src-attr']).toEqual(["'none'"]);
    });

    it('enables upgrade-insecure-requests', () => {
      expect(csp['upgrade-insecure-requests']).toBe(true);
    });

    it('allows self for worker-src', () => {
      expect(csp['worker-src']).toEqual(["'self'"]);
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
