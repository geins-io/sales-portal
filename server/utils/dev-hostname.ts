import { isDevMode } from './dev-mode';

/**
 * The local-only hostname suffix. `pnpm local:setup` installs a dnsmasq
 * wildcard sending all of `*.litium.portal` to 127.0.0.1, so any name under it
 * reaches the dev server without an `/etc/hosts` line.
 */
const DEV_SUFFIX = '.litium.portal';

/** The suffix a tenant is actually registered under in the merchant API. */
const LOOKUP_SUFFIX = '.litium.store';

/**
 * The hostname to look the tenant up by, which in the dev server is not always
 * the hostname the browser asked for.
 *
 * The merchant API only knows a tenant's real hostnames, so a developer who
 * types `name.litium.portal` would get a 404 for every tenant that does not
 * also carry a `.litium.portal` alias in Geins. Under `nuxt dev` the lookup is
 * therefore rewritten to `name.litium.store`, which is where a Geins tenant
 * lives by default — so any registered tenant can be browsed locally by name
 * alone, with nothing to configure.
 *
 * Only the lookup moves. The response is still served under the
 * `.litium.portal` host the browser asked for: `event.context.tenant.hostname`
 * keeps that name, so cookies, redirects, the tenant logger and the 404 body
 * all stay on it. A name the merchant API does not know under either suffix
 * still answers an honest 404.
 *
 * Production and the Azure dev environment receive real hostnames and must
 * never rewrite anything, hence the `isDevMode()` gate — it is a separate
 * module so a unit test can cover both modes.
 */
export function devLookupHostname(hostname: string): string {
  if (!isDevMode()) return hostname;
  if (!hostname.endsWith(DEV_SUFFIX)) return hostname;
  return hostname.slice(0, -DEV_SUFFIX.length) + LOOKUP_SUFFIX;
}
