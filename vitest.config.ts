import type { Plugin } from 'vite';
import {
  defineConfig,
  defineProject,
  type UserWorkspaceConfig,
  type ViteUserConfig,
} from 'vitest/config';
import { getVitestConfigFromNuxt } from '@nuxt/test-utils/config';

// Files that need the full Nuxt test environment (registerEndpoint / mockNuxtImport / useNuxtApp).
// Kept as an explicit list because there are very few and they are structurally distinct from
// regular unit or component tests.
const nuxtTestFiles = [
  'tests/composables/useCmsPreview.test.ts',
  'tests/composables/useStoreSettingsPreview.test.ts',
  'tests/composables/useTenant.test.ts',
  'tests/composables/useErrorTracking.test.ts',
  'tests/components/layout/LayoutHeaderMain.test.ts',
  'tests/components/layout/MobileNavPanel.test.ts',
  'tests/server/api-contracts.test.ts',
  'tests/server/health-memory.test.ts',
  'tests/server/external-api.test.ts',
  'tests/middleware/locale-market-global.test.ts',
  'tests/pages/hydration-miss.test.ts',
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

export default defineConfig(async (): Promise<ViteUserConfig> => {
  // Get Nuxt's Vite config once (aliases, auto-imports, plugins).
  // This single call boots Nuxt exactly once and is reused by all three tiers.
  //
  // Two Vite majors coexist in the tree (the docs site pins the older one), and
  // the config that comes back is typed against a different copy than the one
  // vitest types defineProject against. The Plugin and ServerOptions shapes are
  // structurally identical but nominally distinct, so TypeScript rejects the
  // spread. Re-typing once here beats a cast at each of the three call sites;
  // the value itself is untouched.
  const config = (await getVitestConfigFromNuxt(undefined, {
    overrides: { experimental: { appManifest: false } },
  })) as UserWorkspaceConfig;

  // `deps` is a root-only option; every other test setting goes to each tier.
  const { deps, ...nuxtTest } = config.test ?? {};

  // Merge our nuxt overrides with the environmentOptions already populated by
  // getVitestConfigFromNuxt (nuxtRuntimeConfig, nuxtRouteRules, nuxt.rootId, etc.)
  const baseEnvOptions = nuxtTest.environmentOptions ?? {};
  const mergedEnvOptions = {
    ...baseEnvOptions,
    nuxt: {
      ...((baseEnvOptions as Record<string, unknown>).nuxt as
        | Record<string, unknown>
        | undefined),
      overrides: { experimental: { appManifest: false } },
    },
  };

  return {
    test: {
      deps,
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
      // Each tier carries the whole Nuxt Vite config itself and does not
      // inherit this root config.
      projects: [
        // Tier 1: Node — fast tests with Nuxt's Vite config but no Nuxt runtime
        {
          ...defineProject({
            ...config,
            test: {
              ...nuxtTest,
              name: 'node',
              environment: 'node',
              // Pinned so date-formatting tests are deterministic regardless of
              // the machine/CI runner's local timezone.
              env: { TZ: 'UTC' },
              include: [
                'tests/server/**/*.test.ts',
                'tests/unit/**/*.test.ts',
                'tests/composables/**/*.test.ts',
                'tests/middleware/**/*.test.ts',
                'tests/plugins/**/*.test.ts',
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
            },
          }),
        },
        // Tier 2: Components — happy-dom DOM with mocked useTenant (no Nuxt boot)
        {
          ...defineProject({
            ...config,
            test: {
              ...nuxtTest,
              name: 'components',
              environment: 'happy-dom',
              // Pinned so date-formatting tests are deterministic regardless of
              // the machine/CI runner's local timezone.
              env: { TZ: 'UTC' },
              include: ['tests/components/**/*.test.ts'],
              exclude: [
                ...nuxtTestFiles,
                '**/node_modules/**',
                '**/.nuxt/**',
                '**/dist/**',
              ],
              setupFiles: ['./tests/setup-components.ts'],
              globals: true,
            },
          }),
        },
        // Tier 3: Nuxt — tests that truly need the full Nuxt environment.
        // Reuses the already-resolved Nuxt Vite config to avoid a second Nuxt boot.
        {
          ...defineProject({
            ...config,
            plugins: [
              ...(config.plugins || []),
              nuxtEnvironmentOptionsPlugin(mergedEnvOptions),
            ],
            test: {
              ...nuxtTest,
              name: 'nuxt',
              environment: 'nuxt',
              // Pinned so date-formatting tests are deterministic regardless of
              // the machine/CI runner's local timezone.
              env: { TZ: 'UTC' },
              include: nuxtTestFiles,
              setupFiles: [
                ...(nuxtTest.setupFiles ?? []),
                './tests/setup-nuxt.ts',
              ],
              globals: true,
              environmentOptions: mergedEnvOptions,
            },
          }),
        },
      ],
    },
  };
});
