import { defineVitestConfig } from '@nuxt/test-utils/config';

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    environmentOptions: {
      nuxt: {
        overrides: {
          experimental: {
            appManifest: false,
          },
        },
      },
    },
    // Run tests in parallel
    pool: 'threads',
    // Global test settings
    globals: true,
    // Setup file to mock API endpoints
    setupFiles: ['./tests/setup.ts'],
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['app/**/*.{ts,vue}', 'server/**/*.ts', 'shared/**/*.ts'],
      exclude: [
        'app/components/ui/**', // Exclude shadcn-vue components
        '**/*.d.ts',
        '**/node_modules/**',
        '**/.nuxt/**',
      ],
    },
    // Include patterns (unit and component tests)
    include: ['tests/**/*.test.{ts,js}'],
    // Exclude patterns (E2E tests use Playwright, not Vitest)
    exclude: [
      '**/node_modules/**',
      '**/.nuxt/**',
      '**/dist/**',
      'tests/e2e/**',
    ],
  },
});
