import type { H3Event } from 'h3';

/**
 * Reads runtime-config flags that shape the error handler's response.
 *
 * Isolated in its own module so unit tests can mock it without
 * booting Nuxt. `useRuntimeConfig` is an auto-import resolved by
 * Nitro's build-time transformer; tier-1 (node) tests don't run
 * through that transformer and would otherwise fail with
 * "[nuxt] instance unavailable".
 */
export function readErrorHandlerConfig(event: H3Event): {
  debugErrors: boolean;
} {
  const config = useRuntimeConfig(event);
  return { debugErrors: Boolean(config.debugErrors) };
}
