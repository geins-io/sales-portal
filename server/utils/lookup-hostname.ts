/**
 * The local hostname suffix. `pnpm local:setup` installs a dnsmasq wildcard
 * sending all of `*.litium.test` to 127.0.0.1, so any name under it reaches a
 * local server without an `/etc/hosts` line.
 */
const LOCAL_SUFFIX = '.litium.test';

/** Hostnames routed to the staging slot for release verification. */
const STAGING_SUFFIX = '.staging.litium.store';

/** The suffix a tenant is actually registered under in the merchant API. */
const LOOKUP_SUFFIX = '.litium.store';

/**
 * The hostname to look the tenant up by, which is not always the hostname the
 * browser asked for.
 *
 * The merchant API only knows a tenant's real hostnames, so a developer who
 * types `name.litium.test` would get a 404 for every tenant that does not also
 * carry a `.litium.test` alias in Geins. The lookup is therefore rewritten to
 * `name.litium.store`, which is where a Geins tenant lives by default — so any
 * registered tenant can be browsed by name alone, with nothing to configure.
 *
 * This applies in every mode, the production build included, because the
 * production build is what CI and `E2E_PROD=1` test and they need the same
 * name to work. RFC 6761 reserves `.test` for exactly this: it is never
 * delegated, so a name under it cannot be resolved from the public internet
 * and no deployed environment can ever receive one. The rewrite is therefore
 * unreachable in production while being identical in the build under test —
 * which is the point.
 *
 * Staging names (`name.staging.litium.store`) use the same lookup rewrite,
 * including in production builds: the staging slot runs the image that will
 * be swapped into production. Isolation relies on routing: the DNS-only
 * `*.staging.litium.store` CNAME points to the staging slot's own address,
 * and hostname bindings stay with that slot across a swap. Production traffic
 * therefore keeps its `.litium.store` Host and never matches this rewrite.
 *
 * Aliases registered under either rewritten suffix are ignored; the lookup
 * always uses `.litium.store`. Unknown tenants still answer 404. Positive and
 * negative tenant caches use the rewritten lookup name.
 *
 * Only the lookup moves. The response is still served under the host the
 * browser asked for: `event.context.tenant.hostname` keeps that name, so
 * cookies, redirects, the tenant logger and the 404 body all stay on it.
 */
export function lookupHostname(hostname: string): string {
  for (const suffix of [LOCAL_SUFFIX, STAGING_SUFFIX]) {
    if (hostname.endsWith(suffix)) {
      return hostname.slice(0, -suffix.length) + LOOKUP_SUFFIX;
    }
  }
  return hostname;
}
