/** `fixture` is for CI's e2e and local Playwright runs only. */
export type ConfiguratorBackendName = 'fixture' | 'merchant-api';

const IMPLEMENTED: readonly ConfiguratorBackendName[] = [
  'fixture',
  'merchant-api',
];

/**
 * Reads the runtime key strictly. A GitHub variable that does not exist arrives
 * as an empty string, and an empty `NUXT_*` value overrides the default in
 * nuxt.config.ts instead of falling back to it, so missing and empty both mean
 * merchant-api. Any other value that names no backend, the retired `off`,
 * `sdk` and `composite` included, throws: `server/plugins/06.configurator-backend.ts` runs this
 * at startup, so a mistyped value stops the server instead of picking a backend.
 *
 * Its own module so that `_sdk.ts` and the plugin can use it without loading
 * the backends, and a test that mocks `configurator-config` still has it.
 */
export function resolveConfiguratorBackendName(
  value: unknown,
): ConfiguratorBackendName {
  if (value === undefined || value === '') return 'merchant-api';
  const name = IMPLEMENTED.find((implemented) => implemented === value);
  if (name) return name;
  throw new Error(
    `Unknown CONFIGURATOR_BACKEND ${JSON.stringify(value)}; expected fixture or merchant-api, or nothing for merchant-api`,
  );
}
