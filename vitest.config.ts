import { defineConfig } from 'vitest/config';

/**
 * Base Vitest config — shared settings only (coverage).
 * Test environment and file routing is handled by vitest.workspace.ts.
 */
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['app/**/*.{ts,vue}', 'server/**/*.ts', 'shared/**/*.ts'],
      exclude: [
        'app/components/ui/**',
        '**/*.d.ts',
        '**/node_modules/**',
        '**/.nuxt/**',
      ],
    },
  },
});
