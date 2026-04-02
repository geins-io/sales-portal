// https://nuxt.com/docs/api/configuration/nuxt-config
import type { Environment } from './shared/types/common';
import type { NuxtPage } from 'nuxt/schema';

/**
 * Recursively create /:market/:locale-prefixed copies of page routes.
 * Each prefixed route uses the same component file but with the market/locale
 * segments as route params, so Vue Router matches /se/sv/search natively.
 */
function createPrefixedRoutes(pages: NuxtPage[], depth = 0): NuxtPage[] {
  const result: NuxtPage[] = [];

  for (const page of pages) {
    const prefixedPath =
      depth === 0
        ? `/:market/:locale${page.path === '/' ? '' : page.path}`
        : page.path;

    const prefixed: NuxtPage = {
      ...page,
      name: depth === 0 ? `locale-${page.name ?? ''}` : page.name,
      path: prefixedPath,
      children: page.children?.length
        ? createPrefixedRoutes(page.children, depth + 1)
        : page.children,
    };

    result.push(prefixed);
  }

  return result;
}

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  hooks: {
    'pages:extend'(pages) {
      // Register /:market/:locale-prefixed versions of all page routes.
      // This allows named pages (search.vue, checkout.vue, index.vue, etc.)
      // to be reached via /se/sv/search, /se/sv/checkout, /se/sv/ etc.
      // Without this, only the [...slug] catch-all works with prefixed URLs.
      // See: server/plugins/00.locale-market.ts for URL parsing.
      const prefixed = createPrefixedRoutes(pages);
      pages.push(...prefixed);
    },
  },

  modules: [
    // Always needed (aliases, auto-imports, component resolution)
    '~~/modules/graphql-loader',
    '@nuxt/eslint',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxtjs/tailwindcss',
    '@nuxtjs/i18n',
    '@nuxtjs/seo',
    '@nuxt/test-utils',
    'shadcn-nuxt',
    '@pinia/nuxt',

    // Runtime-only modules (skip during tests — no aliases or auto-imports needed)
    ...(!process.env.VITEST
      ? [
          '@sentry/nuxt/module',
          'nuxt-security',
          '@nuxt/fonts',
          '@nuxt/scripts',
          '@nuxt/hints',
        ]
      : []),
  ],

  security: {
    // Nonce-based CSP requires a single SSR pass so header and tag nonces
    // match. Vite dev mode renders in multiple passes, producing different
    // nonces that the browser rejects. Enable nonce + SRI only in prod.
    nonce: process.env.NODE_ENV === 'production',
    sri: process.env.NODE_ENV === 'production',
    headers: {
      // Strict CSP for production only. In dev, nuxt-security still sets
      // other security headers (X-Content-Type-Options, etc.) but CSP is
      // disabled to avoid blocking scripts/styles via nonce mismatches.
      contentSecurityPolicy:
        process.env.NODE_ENV === 'production'
          ? {
              'default-src': ["'none'"],
              'script-src': ["'self'", "'strict-dynamic'", "'nonce-{{nonce}}'"],
              'style-src': [
                "'self'",
                "'nonce-{{nonce}}'",
                'https://fonts.googleapis.com',
              ],
              'font-src': ["'self'", 'https://fonts.gstatic.com'],
              'img-src': ["'self'", 'data:', 'https:'],
              'connect-src': [
                "'self'",
                'https://merchantapi.geins.io',
                'https://*.sentry.io',
                'https://www.google-analytics.com',
                'https://www.googletagmanager.com',
              ],
              'frame-ancestors': ["'none'"],
              'frame-src': ["'self'"],
              'base-uri': ["'none'"],
              'form-action': ["'self'"],
              'object-src': ["'none'"],
              'script-src-attr': ["'none'"],
              'manifest-src': ["'self'"],
              'worker-src': ["'self'"],
              'upgrade-insecure-requests': true,
            }
          : false,
      xContentTypeOptions: 'nosniff',
      xFrameOptions: 'DENY',
      referrerPolicy: 'strict-origin-when-cross-origin',
      crossOriginEmbedderPolicy: false,
    },
    rateLimiter: false,
    requestSizeLimiter: false,
    xssValidator: false,
    corsHandler: false,
  },

  fonts: {
    families: [
      { name: 'Geist', provider: 'fontsource', weights: [400, 500, 600, 700] },
      { name: 'Hanuman', provider: 'google', weights: [400, 700] },
    ],
  },

  image: {
    domains: ['commerce.services'],
  },

  i18n: {
    restructureDir: 'app',
    defaultLocale: 'sv',
    locales: [
      { code: 'en', language: 'en', name: 'English', file: 'en.json' },
      { code: 'sv', language: 'sv-SE', name: 'Svenska', file: 'sv.json' },
    ],
    langDir: 'locales',
    strategy: 'no_prefix',
    detectBrowserLanguage: false,
  },

  // @nuxtjs/seo configuration — per-tenant values set at request time
  // by server/plugins/03.seo-config.ts via the site-config:init hook
  site: {
    // Placeholder — overridden per-request by server/plugins/03.seo-config.ts
    url: 'https://portal.litium.com',
    name: 'Sales Portal',
  },
  robots: { enabled: true },
  sitemap: {
    enabled: true,
    sources: ['/api/__sitemap__/urls'],
  },
  schemaOrg: { enabled: true },
  ogImage: { enabled: false },
  linkChecker: { enabled: false },

  // Sentry build-time configuration for source maps (optional)
  // If SENTRY_AUTH_TOKEN is not set, source maps won't be uploaded
  // If SENTRY_DSN (server) is not set, server-side error tracking will be disabled at runtime
  sentry: {
    // Sentry organization and project slugs for source map uploads
    // Only required if you want source map uploads
    org: process.env.SENTRY_ORG || '',
    project: process.env.SENTRY_PROJECT || '',
    // Auth token for source map uploads (optional - if not set, source maps won't be uploaded)
    authToken: process.env.SENTRY_AUTH_TOKEN || '',
  },

  // Enable client-side source maps for better error stack traces
  sourcemap: {
    client: 'hidden',
  },

  pinia: {
    storesDirs: ['./app/stores/**'],
  },

  css: ['~/assets/css/tailwind.css'],

  /**
   * ============================================================================
   * RUNTIME CONFIGURATION
   * ============================================================================
   *
   * All values below can be overridden at RUNTIME using environment variables.
   * Nuxt automatically maps config keys to env vars:
   *
   *   runtimeConfig.someKey         → NUXT_SOME_KEY
   *   runtimeConfig.nested.key      → NUXT_NESTED_KEY
   *   runtimeConfig.public.someKey  → NUXT_PUBLIC_SOME_KEY
   *
   * ┌─────────────────────────────────────────────────────────────────────────┐
   * │ WHERE TO SET ENVIRONMENT VARIABLES                                      │
   * ├─────────────────────────────────────────────────────────────────────────┤
   * │ AZURE APP SERVICE (runtime)     │ GITHUB SECRETS (build-time only)     │
   * │ ─────────────────────────────── │ ──────────────────────────────────── │
   * │ NUXT_AUTO_CREATE_TENANT         │ SENTRY_AUTH_TOKEN                    │
   * │ NUXT_GEINS_API_ENDPOINT         │ SENTRY_ORG                           │
   * │ NUXT_GEINS_TENANT_API_URL       │ SENTRY_PROJECT                       │
   * │ NUXT_GEINS_TENANT_API_KEY       │                                      │
   * │ NUXT_STORAGE_DRIVER             │                                      │
   * │ NUXT_STORAGE_REDIS_URL          │                                      │
   * │ NUXT_HEALTH_CHECK_SECRET        │                                      │
   * │ NUXT_EXTERNAL_API_BASE_URL      │                                      │
   * │ NUXT_SENTRY_DSN                 │                                      │
   * │ NUXT_WEBHOOK_SECRET              │                                      │
   * │ NUXT_LOGGING_VERBOSE_REQUESTS   │                                      │
   * │ NUXT_PUBLIC_FEATURES_ANALYTICS  │                                      │
   * └─────────────────────────────────────────────────────────────────────────┘
   *
   * NOTE: Values set here are defaults. Azure env vars override them at runtime.
   * Do NOT use process.env here - let Nuxt handle the mapping automatically.
   */
  runtimeConfig: {
    // ── Private Config (server-side only, not exposed to client) ────────────

    // Auto-create tenants for unknown hostnames
    // Azure: NUXT_AUTO_CREATE_TENANT=true
    autoCreateTenant: false,

    // Geins API configuration
    // Azure: NUXT_GEINS_API_ENDPOINT, NUXT_GEINS_TENANT_API_URL, NUXT_GEINS_TENANT_API_KEY
    geins: {
      apiEndpoint: 'https://merchantapi.geins.io/graphql',
      tenantApiUrl: 'https://merchantapi.geins.io/store-settings',
    },

    // Storage configuration (memory for dev, redis for production)
    // Azure: NUXT_STORAGE_DRIVER=redis, NUXT_STORAGE_REDIS_URL=redis://...
    storage: {
      driver: 'memory',
      redisUrl: '',
    },

    // Secret for accessing detailed health check metrics
    // Azure: NUXT_HEALTH_CHECK_SECRET=your-secret-here
    healthCheckSecret: '',

    // External API base URL for the proxy
    // Azure: NUXT_EXTERNAL_API_BASE_URL=https://your-external-api.com
    externalApiBaseUrl: 'https://api.app.com',
    // Sentry error tracking (server-side only)
    // Azure: NUXT_SENTRY_DSN=https://xxx@sentry.io/xxx
    // Note: DSN is kept server-side only to avoid exposing configuration to clients.
    // Client-side error tracking is disabled by default for security hardening.
    sentry: {
      dsn: '',
    },

    // Shared secret for webhook signature verification
    // Azure: NUXT_WEBHOOK_SECRET=your-shared-secret-here
    webhookSecret: '',

    // Logging configuration
    // Azure: NUXT_LOGGING_VERBOSE_REQUESTS=true
    logging: {
      // When true, request logs include full headers (sanitized).
      // Useful for debugging but can be noisy in production.
      verboseRequests: false,
    },

    // ── Public Config (exposed to client) ───────────────────────────────────
    public: {
      // App metadata (typically not overridden)
      appName: 'Sales Portal',
      appVersion: '1.0.1',
      versionX: 'n/a',

      // Build info - set by GitHub Actions during build, not in Azure
      commitSha: process.env.GITHUB_SHA || 'n/a',

      // Environment detection
      environment: (process.env.NODE_ENV as Environment) || 'development',

      // Feature flags
      // Azure: NUXT_PUBLIC_FEATURES_ANALYTICS=true
      features: {
        analytics: false,
      },

      // Client API configuration (usually no need to override)
      api: {
        baseUrl: '/api',
        timeout: 30000,
      },
    },
  },

  nitro: {
    storage: {
      kv: {
        driver: 'memory',
      },
    },
    // Enable compression
    compressPublicAssets: true,
    // Production optimizations
    minify: true,
  },

  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
  ],

  shadcn: {
    prefix: '',
    componentDir: './app/components/ui',
  },

  // TypeScript configuration
  typescript: {
    strict: true,
    typeCheck: false, // Disable for faster builds, run separately in CI
  },

  // App configuration
  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      link: [{ rel: 'preconnect', href: 'https://merchantapi.geins.io' }],
    },
  },

  // Experimental features
  experimental: {
    payloadExtraction: true,
    buildCache: true,
  },

  // Vite configuration
  vite: {
    server: {
      allowedHosts: ['.litium.portal'],
    },
  },
});
