import type { Plugin } from 'vite';
import { defineProject } from 'vitest/config';
import { getVitestConfigFromNuxt } from '@nuxt/test-utils/config';

// Files that need the full Nuxt test environment (registerEndpoint / mockNuxtImport / useNuxtApp).
// Kept as an explicit list because there are very few and they are structurally distinct from
// regular unit or component tests.
const nuxtTestFiles = [
  'tests/composables/useCmsPreview.test.ts',
  'tests/composables/useTenant.test.ts',
  'tests/composables/useErrorTracking.test.ts',
  'tests/components/layout/LayoutHeaderMain.test.ts',
  'tests/components/layout/MobileNavPanel.test.ts',
  'tests/server/api-contracts.test.ts',
  'tests/server/external-api.test.ts',
];

// Vite plugin that provides Nuxt environment options to @nuxt/test-utils at runtime.
// Mirrors the unexported NuxtVitestEnvironmentOptionsPlugin from @nuxt/test-utils/config.
function nuxtEnvironmentOptionsPlugin(
  environmentOptions: Record<string, unknown> = {},
): Plugin {
  const STUB_ID = 'nuxt-vitest-environment-options';
  return {
    name: 'nuxt:vitest:nuxt-environment-options',
    enforce: 'pre',
    resolveId(id) {
      if (id.endsWith(STUB_ID)) return STUB_ID;
    },
    load(id) {
      if (id.endsWith(STUB_ID))
        return `export default ${JSON.stringify(environmentOptions)}`;
    },
  };
}

// Get Nuxt's Vite config once (aliases, auto-imports, plugins).
// This single call boots Nuxt exactly once and is reused by all three tiers.
const nuxtViteConfig = getVitestConfigFromNuxt(undefined, {
  overrides: { experimental: { appManifest: false } },
});

export default [
  // Tier 1: Node — fast tests with Nuxt's Vite config but no Nuxt runtime
  nuxtViteConfig.then((config) =>
    defineProject({
      ...config,
      test: {
        ...config.test,
        name: 'node',
        environment: 'node',
        include: [
          'tests/server/**/*.test.ts',
          'tests/unit/**/*.test.ts',
          'tests/composables/**/*.test.ts',
          'tests/middleware/**/*.test.ts',
          'tests/shared/**/*.test.ts',
          'tests/stores/**/*.test.ts',
          'tests/utils/**/*.test.ts',
        ],
        exclude: [
          ...nuxtTestFiles,
          '**/node_modules/**',
          '**/.nuxt/**',
          '**/dist/**',
        ],
        setupFiles: ['./tests/setup.ts'],
        globals: true,
        isolate: false,
        sequence: { concurrent: true },
      },
    }),
  ),
  // Tier 2: Components — happy-dom DOM with mocked useTenant (no Nuxt boot)
  nuxtViteConfig.then((config) =>
    defineProject({
      ...config,
      test: {
        ...config.test,
        name: 'components',
        environment: 'happy-dom',
        include: ['tests/components/**/*.test.ts'],
        exclude: [
          ...nuxtTestFiles,
          '**/node_modules/**',
          '**/.nuxt/**',
          '**/dist/**',
        ],
        setupFiles: ['./tests/setup-components.ts'],
        globals: true,
        isolate: false,
        sequence: { concurrent: true },
      },
    }),
  ),
  // Tier 3: Nuxt — tests that truly need the full Nuxt environment.
  // Reuses the already-resolved Nuxt Vite config to avoid a second Nuxt boot.
  nuxtViteConfig.then((config) => {
    // Merge our nuxt overrides with the environmentOptions already populated by
    // getVitestConfigFromNuxt (nuxtRuntimeConfig, nuxtRouteRules, nuxt.rootId, etc.)
    const baseEnvOptions = config.test?.environmentOptions ?? {};
    const mergedEnvOptions = {
      ...baseEnvOptions,
      nuxt: {
        ...((baseEnvOptions as Record<string, unknown>).nuxt as
          | Record<string, unknown>
          | undefined),
        overrides: { experimental: { appManifest: false } },
      },
    };

    return defineProject({
      ...config,
      plugins: [
        ...(config.plugins || []),
        nuxtEnvironmentOptionsPlugin(mergedEnvOptions),
      ],
      test: {
        ...config.test,
        name: 'nuxt',
        environment: 'nuxt',
        include: nuxtTestFiles,
        setupFiles: [
          ...(config.test?.setupFiles ?? []),
          './tests/setup-nuxt.ts',
        ],
        globals: true,
        sequence: { concurrent: true },
        environmentOptions: mergedEnvOptions,
      },
    });
  }),
];
