/**
 * The local hostname suffix. `pnpm local:setup` installs a dnsmasq wildcard
 * sending all of `*.litium.portal` to 127.0.0.1, so any name under it reaches
 * a local server without an `/etc/hosts` line.
 */
const LOCAL_SUFFIX = '.litium.portal';

/** The suffix a tenant is actually registered under in the merchant API. */
const LOOKUP_SUFFIX = '.litium.store';

/**
 * The hostname to look the tenant up by, which is not always the hostname the
 * browser asked for.
 *
 * The merchant API only knows a tenant's real hostnames, so a developer who
 * types `name.litium.portal` would get a 404 for every tenant that does not
 * also carry a `.litium.portal` alias in Geins. The lookup is therefore
 * rewritten to `name.litium.store`, which is where a Geins tenant lives by
 * default — so any registered tenant can be browsed by name alone, with
 * nothing to configure.
 *
 * This applies in every mode, the production build included, because the
 * production build is what CI and `E2E_PROD=1` test and they need the same
 * name to work. `.portal` is not a real top-level domain: a name under it
 * cannot be resolved from the public internet, so no deployed environment can
 * ever receive one. The rewrite is therefore unreachable in production while
 * being identical in the build under test — which is the point.
 *
 * The one behaviour it takes away: a tenant that registers `X.litium.portal`
 * as an alias in Geins is no longer reachable under that exact name, since the
 * lookup resolves `X.litium.store` instead. Only local and CI traffic can
 * carry such a name, and an unknown one still answers an honest 404.
 *
 * Only the lookup moves. The response is still served under the host the
 * browser asked for: `event.context.tenant.hostname` keeps that name, so
 * cookies, redirects, the tenant logger and the 404 body all stay on it.
 */
export function lookupHostname(hostname: string): string {
  if (!hostname.endsWith(LOCAL_SUFFIX)) return hostname;
  return hostname.slice(0, -LOCAL_SUFFIX.length) + LOOKUP_SUFFIX;
}
