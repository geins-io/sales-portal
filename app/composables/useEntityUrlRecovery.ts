import type { ResolvedEntityUrl } from '~~/server/services/url-resolver';
import { stripLocaleMarketPrefix } from '#shared/utils/locale-market';
import { isSafeInternalPath } from '#shared/utils/redirect';

/**
 * Content-miss recovery: the reusable extraction of the catch-all's inline
 * resolver hop (app/pages/[...slug].vue). A page calls this when its primary
 * content load misses (CMS page / product / category not found) to give the
 * cached resolver a chance to 301 the URL to its canonical form instead of
 * throwing 404 outright.
 *
 * Behaviour:
 *  - `{ type, canonicalAppPath }`: 301-redirect to `canonicalAppPath` unless it
 *    equals the incoming path (loop guard), in which case 404.
 *  - `{ redirect }`: re-apply the current locale prefix (a renamed slug is a
 *    bare path) and 301-redirect, unless it equals the incoming path -> 404.
 *  - `null` / fetch error: throw a fatal 404.
 *
 * SSR-safe: `useFetch` auto-forwards cookie + host on page-level loads, and
 * `navigateTo(..., { redirectCode })` works in setup during SSR (proven by the
 * catch-all). No `window` / `history` usage.
 *
 * @param path - The incoming path to recover (use the route's path; do NOT
 *   re-derive locale beyond the prefix re-apply for the rename case).
 */
export async function recoverEntityUrl(path: string): Promise<void> {
  const { localePath } = useLocaleMarket();

  function throwNotFound(): never {
    throw createError({ statusCode: 404, fatal: true });
  }

  const { data, error } = await useFetch<ResolvedEntityUrl>(
    '/api/resolve-url',
    {
      query: { path },
      dedupe: 'defer',
    },
  );

  const res = error.value ? null : data.value;

  if (res && 'canonicalAppPath' in res && res.canonicalAppPath) {
    const target = res.canonicalAppPath;
    // Defense in depth: never hand navigateTo an off-origin or
    // protocol-relative path. An unsafe target is a terminal miss.
    if (!isSafeInternalPath(target)) throwNotFound();
    if (target !== path) {
      await navigateTo(target, { redirectCode: 301, replace: true });
      return;
    }
    throwNotFound();
  }

  if (res && 'redirect' in res && res.redirect) {
    // A renamed slug is a bare url with no entity type; re-apply the current
    // locale prefix only. A rename is a different path, so this cannot loop;
    // the equality guard is defensive against a self-referential record.
    const target = localePath(stripLocaleMarketPrefix(res.redirect));
    // Defense in depth: never hand navigateTo an off-origin or
    // protocol-relative path. An unsafe target is a terminal miss.
    if (!isSafeInternalPath(target)) throwNotFound();
    if (target !== path) {
      await navigateTo(target, { redirectCode: 301, replace: true });
      return;
    }
    throwNotFound();
  }

  throwNotFound();
}
