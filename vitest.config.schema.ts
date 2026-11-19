import {
  defineConfig,
  type UserWorkspaceConfig,
  type ViteUserConfig,
} from 'vitest/config';
import { getVitestConfigFromNuxt } from '@nuxt/test-utils/config';

// Its own config, not a project in vitest.config.ts: `vitest run` runs every
// project there, and this one needs the network. Nuxt's Vite config resolves
// the `#graphql-queries` alias the loader imports.
export default defineConfig(async (): Promise<ViteUserConfig> => {
  // Re-typed for the same two-Vite-majors reason as in vitest.config.ts.
  const config = (await getVitestConfigFromNuxt(undefined, {
    overrides: { experimental: { appManifest: false } },
  })) as UserWorkspaceConfig;
  return {
    ...config,
    test: {
      ...config.test,
      name: 'schema',
      environment: 'node',
      include: ['tests/schema/**/*.test.ts'],
    },
  };
});
