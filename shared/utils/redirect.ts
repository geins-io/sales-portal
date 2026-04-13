/**
 * Shared redirect-target validation.
 *
 * Use this everywhere we read a `redirect` query/body param and are about to
 * hand it back to the browser in a `Location` header or client-side router
 * replace. Returning true ONLY for relative in-app paths prevents open-redirect
 * attacks where a caller crafts `?redirect=//evil.com` or `?redirect=https://evil.com`.
 *
 * Rules:
 * - Must be a non-empty string
 * - Must start with a single `/`
 * - Must not start with `/\` — browsers normalise `\` to `/`, so `/\evil.com`
 *   acts like `//evil.com` and reaches an external origin
 * - Must not contain `//` anywhere — protocol-relative at position 0, and
 *   a defensive reject elsewhere (legitimate paths should never contain `//`)
 * - Must not contain `://` (catches `javascript:`, `http:`, `data:`, etc.)
 */
export function isSafeInternalPath(path: unknown): path is string {
  if (typeof path !== 'string' || path.length === 0) return false;
  if (!path.startsWith('/')) return false;
  if (path.startsWith('/\\')) return false;
  if (path.includes('//')) return false;
  if (path.includes('://')) return false;
  return true;
}
