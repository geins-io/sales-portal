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
  ],

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
    // Health check secret for detailed metrics
    healthCheckSecret: process.env.HEALTH_CHECK_SECRET || 'health-check-secret',
    // Public config (exposed to client)
    public: {
      // App information
      appName: 'Sales Portal',
      appVersion: '1.0.0',
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
