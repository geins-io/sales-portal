// https://nuxt.com/docs/api/configuration/nuxt-config
import type { Environment } from './shared/types/common';

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/hints',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxtjs/tailwindcss',
    '@nuxt/scripts',
    '@nuxt/test-utils',
    'shadcn-nuxt',
    '@pinia/nuxt',
    '@sentry/nuxt/module',
  ],

  // Sentry build-time configuration for source maps (optional)
  // If SENTRY_AUTH_TOKEN is not set, source maps won't be uploaded
  // If SENTRY_DSN is not set, error tracking will be disabled at runtime
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

  css: ['~/assets/css/tailwind.css', '~/assets/css/themes.css'],

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
   * │ NUXT_PUBLIC_SENTRY_DSN          │                                      │
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
      tenantApiUrl: '',
      tenantApiKey: '',
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

      // Sentry error tracking (client-side)
      // Azure: NUXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
      sentry: {
        dsn: '',
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
      path: '~/components/shared',
      pathPrefix: false, // Makes Logo available as <Logo /> instead of <SharedLogo />
    },
    '~/components', // Default component scanning
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
      htmlAttrs: {
        lang: 'en',
      },
    },
  },

  // Experimental features
  experimental: {
    // Enable payload extraction for better caching
    payloadExtraction: true,
  },
});
