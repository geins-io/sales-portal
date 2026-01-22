// https://nuxt.com/docs/api/configuration/nuxt-config
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
   * Runtime configuration
   * These values can be overridden using environment variables:
   * - NUXT_PUBLIC_* for public config
   * - NUXT_* for private server-side config
   */
  runtimeConfig: {
    // Private server-side config (not exposed to client)
    // Auto-create tenants for unknown hostnames (useful for local development)
    // Override at runtime with NUXT_AUTO_CREATE_TENANT=true
    autoCreateTenant: process.env.NUXT_AUTO_CREATE_TENANT === 'true',
    geins: {
      apiEndpoint:
        process.env.GEINS_API_ENDPOINT ||
        'https://merchantapi.geins.io/graphql',
    },
    // Redis/KV configuration for production
    storage: {
      driver: process.env.STORAGE_DRIVER || 'fs',
      redisUrl: process.env.REDIS_URL || '',
    },
    // Health check secret for detailed metrics (must be explicitly configured)
    healthCheckSecret: process.env.HEALTH_CHECK_SECRET || '',
    // Public config (exposed to client)
    public: {
      // App information
      appName: 'Sales Portal',
      appVersion: '1.0.0',
      commitSha: process.env.COMMIT_SHA || process.env.GITHUB_SHA || 'dev',
      // Environment
      environment:
        (process.env.NODE_ENV as 'development' | 'production' | 'test') ||
        'development',
      // Feature flags
      features: {
        analytics: process.env.NUXT_PUBLIC_ENABLE_ANALYTICS === 'true',
      },
      // API configuration
      api: {
        baseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || '/api',
        timeout: parseInt(process.env.NUXT_PUBLIC_API_TIMEOUT || '30000', 10),
      },
      // Sentry configuration
      sentry: {
        dsn: process.env.NUXT_PUBLIC_SENTRY_DSN || '',
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
