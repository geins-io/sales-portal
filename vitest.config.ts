import { defineVitestConfig } from '@nuxt/test-utils/config';

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    // Run tests in parallel
    pool: 'threads',
    // Global test settings
    globals: true,
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
    // Include patterns
    include: ['tests/**/*.{test,spec}.{ts,js}'],
    // Exclude patterns
    exclude: ['**/node_modules/**', '**/.nuxt/**', '**/dist/**'],
  },
});
