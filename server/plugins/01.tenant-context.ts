// import { KV_STORAGE_KEYS } from '#shared/constants/storage';

/**
 * Normalizes a hostname by removing the port number.
 * This ensures consistent storage keys regardless of the port used.
 */
function normalizeHostname(hostname: string): string {
  // Remove port if present (e.g., "tenant-a.localhost:3000" -> "tenant-a.localhost")
  return hostname.split(':')[0];
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', async (event) => {
    // Get the request host for dynamic request routing
    // without considering the `X-Forwarded-Host` header which could be spoofed.
    const rawHostname = getRequestHost(event, { xForwardedHost: false });
    const hostname = normalizeHostname(rawHostname ?? '');

    // TODO: add other tenant data from the database here
    // import { KV_STORAGE_KEYS } from '#shared/constants/storage';
    // const id = await useStorage('kv').getItem<string>(`${KV_STORAGE_KEYS.TENANT_ID_PREFIX}${hostname}`);

    // Attach tenant data to the event context to make it
    // available to all server routes and middleware.
    event.context.tenant = { id: hostname, hostname };
  });
});
