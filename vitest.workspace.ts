import { defineProject } from 'vitest/config';
import {
  defineVitestProject,
  getVitestConfigFromNuxt,
} from '@nuxt/test-utils/config';

// Files that need the full Nuxt test environment
const nuxtTestFiles = [
  'tests/composables/useCmsPreview.test.ts',
  'tests/composables/useTenant.test.ts',
  'tests/composables/useErrorTracking.test.ts',
  'tests/components/Button.test.ts',
  'tests/components/Copyright.test.ts',
  'tests/components/ErrorBoundary.test.ts',
  'tests/components/Logo.test.ts',
  'tests/components/PoweredBy.test.ts',
  'tests/components/SearchBar.test.ts',
  'tests/components/layout/LayoutFooter.test.ts',
  'tests/components/layout/LayoutHeaderActionButtons.test.ts',
  'tests/components/layout/LayoutHeaderMain.test.ts',
  'tests/components/layout/LayoutHeaderNav.test.ts',
  'tests/components/layout/LayoutHeaderTopbar.test.ts',
  'tests/components/layout/MobileNavPanel.test.ts',
  'tests/server/api-contracts.test.ts',
  'tests/server/external-api.test.ts',
];

// Get Nuxt's Vite config once (aliases, auto-imports, plugins)
const nuxtViteConfig = getVitestConfigFromNuxt(undefined, {
  overrides: { experimental: { appManifest: false } },
});

export default [
  // Node project: fast tests with Nuxt's Vite config but no Nuxt runtime
  nuxtViteConfig.then((config) =>
    defineProject({
      ...config,
      test: {
        ...config.test,
        name: 'node',
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        exclude: [
          ...nuxtTestFiles,
          '**/node_modules/**',
          '**/.nuxt/**',
          '**/dist/**',
          'tests/e2e/**',
        ],
        setupFiles: ['./tests/setup.ts'],
        globals: true,
      },
    }),
  ),
  // Nuxt project: tests that need the full Nuxt environment
  defineVitestProject({
    test: {
      name: 'nuxt',
      include: nuxtTestFiles,
      setupFiles: ['./tests/setup-nuxt.ts'],
      globals: true,
      environmentOptions: {
        nuxt: {
          overrides: {
            experimental: { appManifest: false },
          },
        },
      },
    },
  }),
];
