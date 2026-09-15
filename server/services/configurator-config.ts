import type { H3Event } from 'h3';

/**
 * Reads the raw `configurator.backend` runtime key.
 *
 * Isolated in its own module for the same reason as
 * `server/utils/error-config.ts`: `useRuntimeConfig` is a Nuxt auto-import that
 * resolves to the app's implementation under vitest, where there is no Nuxt
 * instance, so a global stub cannot reach it and a test mocks this module
 * instead. The value is returned unparsed — the parser lives with the seam.
 */
export function readConfiguratorBackendValue(event: H3Event): unknown {
  return useRuntimeConfig(event).configurator?.backend;
}
