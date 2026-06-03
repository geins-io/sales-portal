/**
 * Tier 2 wrong-shape URL middleware.
 *
 * Global route middleware is the only hook that fires on BOTH the SSR render
 * and every client navigation, so it is where definitively-wrong path shapes
 * get repaired into a real 301 (SSR) / soft replace (SPA).
 *
 * Engages ONLY on the two prefixes that have no page route: `/l/` (Geins list)
 * and `/dc/` (discount campaign). Everything else is left untouched:
 *  - typed routes (/c /p /b /s) already render a page,
 *  - prefix-less paths are CMS / catch-all ([...slug].vue, Tier 1b) territory,
 *  - non-prefixed paths (no /{market}/{locale}/) are not entity URLs.
 *
 * A fast path-shape guard runs BEFORE any network call: this keeps the
 * middleware cheap and idempotent, which matters because it double-executes
 * (once on SSR, once on the client hydration nav). On an already-correct or
 * already-redirected path the guard makes the second run a no-op.
 *
 * Loop safety: compare the resolved target against the incoming path and no-op
 * when they are equal; on a terminal miss abort with a 404 rather than
 * redirecting one miss to another. ?query and #hash are carried through.
 *
 * Locale hard-block: this middleware ONLY rewrites the path shape. It never
 * writes the locale cookie, never calls setLocale, never re-derives locale.
 * It is ordered AFTER `locale-market.global.ts` (filename sorts later), so the
 * i18n locale is already synced from the URL before this runs.
 */

import type { ResolvedEntityUrl } from '~~/server/services/url-resolver';
import { isSafeInternalPath } from '#shared/utils/redirect';

/** Type-prefix segments that already have a page route: never engage on these. */
const TYPED_PREFIXES = new Set(['c', 'p', 'b', 's']);

/** Wrong-shape prefixes with no page route: the only shapes we repair. */
const WRONG_SHAPE_PREFIXES = new Set(['l', 'dc']);

export default defineNuxtRouteMiddleware(async (to) => {
  const segments = to.path.split('/').filter(Boolean);

  // Fast path-shape guard (zero network). Bail unless the path is under
  // /{market}/{locale}/{prefix}/... AND {prefix} is a wrong shape.
  if (
    segments.length < 3 ||
    !/^[a-z]{2}$/.test(segments[0]!) ||
    !/^[a-z]{2}$/.test(segments[1]!)
  ) {
    return;
  }

  const prefix = segments[2]!;

  // Already a typed route (/c /p /b /s): a page owns it.
  if (TYPED_PREFIXES.has(prefix)) return;

  // Prefix-less / unknown prefix: catch-all (Tier 1b) owns it.
  if (!WRONG_SHAPE_PREFIXES.has(prefix)) return;

  // Engaged. Reach the cached resolver. On the server, forward cookie AND host
  // so tenant resolution survives the self-fetch (internalFetch forwards cookie
  // only, so host is added explicitly here).
  const res = await $fetch<ResolvedEntityUrl>('/api/resolve-url', {
    query: { path: to.path },
    headers: import.meta.server
      ? useRequestHeaders(['cookie', 'host'])
      : undefined,
  }).catch(() => null);

  const resolvedPath =
    res && 'canonicalAppPath' in res
      ? res.canonicalAppPath
      : res && 'redirect' in res
        ? res.redirect
        : null;

  // Terminal miss: 404, never redirect a miss to another miss.
  if (!resolvedPath) {
    return abortNavigation(createError({ statusCode: 404 }));
  }

  // Defense in depth: the resolver already guards its redirects, but never
  // hand an off-origin or protocol-relative path to navigateTo. An unsafe
  // target is treated as a terminal miss (404), not a redirect.
  if (!isSafeInternalPath(resolvedPath)) {
    return abortNavigation(createError({ statusCode: 404 }));
  }

  // Loop guard: a self-referential resolution must not navigate.
  if (resolvedPath === to.path) return;

  // Re-attach ?query and #hash so deep-link state survives the redirect.
  const search = new URLSearchParams(
    to.query as Record<string, string>,
  ).toString();
  const target = `${resolvedPath}${search ? `?${search}` : ''}${to.hash}`;

  return navigateTo(target, { redirectCode: 301, replace: true });
});
