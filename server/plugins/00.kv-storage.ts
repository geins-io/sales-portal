import redisDriver from 'unstorage/drivers/redis';

/**
 * Mounts the 'kv' storage namespace (tenant configs, webhook dedup — see
 * server/utils/tenant.ts, server/utils/webhook-handler.ts) at container
 * start.
 *
 * This deliberately does not live in nuxt.config.ts. `nitro.storage` is
 * serialized into .output/server when the image is built, so a mount
 * decided there reads the *build* container's environment — which has no
 * NUXT_STORAGE_* set — and bakes `memory` in permanently. The runtime env
 * var would then still override `runtimeConfig.storage.driver`, so the app
 * reports 'redis' while every write goes to an in-process Map that the next
 * restart discards. Mounting here reads the environment the server actually
 * runs in, and keeps the connection string out of the image so one built
 * artifact can be promoted across environments.
 *
 * Misconfiguration fails the process rather than falling back to memory: a
 * silent fallback in production is indistinguishable from a working
 * deployment right up until a restart wipes every onboarded tenant.
 */
/** What the environment asks the kv namespace to be mounted on. */
export type KvMount = { driver: 'memory' } | { driver: 'redis'; url: string };

/**
 * Reads the mount out of an environment, separately from applying it, so the
 * decision — including both refusals — is testable without a live Redis or a
 * booted Nitro.
 */
export function resolveKvMount(env: NodeJS.ProcessEnv): KvMount {
  const driver = env.NUXT_STORAGE_DRIVER || 'memory';

  if (driver === 'memory') return { driver: 'memory' };

  if (driver !== 'redis') {
    throw new Error(
      `Unknown NUXT_STORAGE_DRIVER: "${driver}". Expected "memory" or "redis".`,
    );
  }

  const url = env.NUXT_STORAGE_REDIS_URL;
  if (!url) {
    throw new Error(
      'NUXT_STORAGE_DRIVER=redis but NUXT_STORAGE_REDIS_URL is not set. ' +
        'Refusing to silently fall back to in-memory storage in this mode — ' +
        'set the URL or unset NUXT_STORAGE_DRIVER.',
    );
  }

  return { driver: 'redis', url };
}

export default defineNitroPlugin(() => {
  const mount = resolveKvMount(process.env);

  // nitro.storage already mounts 'kv' as memory, so there is nothing to do.
  if (mount.driver === 'memory') return;

  // `base` is the Redis key prefix, unrelated to the 'kv' mount point.
  useStorage().mount('kv', redisDriver({ url: mount.url, base: 'kv' }));
});
