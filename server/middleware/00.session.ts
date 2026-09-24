import { resolveSession } from '../utils/auth';
import { isPagePath } from '../utils/is-page-path';

/**
 * Decides the session once, before any route reads a token, so every consumer
 * of this request — SDK context, cache identity, Cache-Control — sees the same
 * one. On a page request the rotated cookies go out on the page response: an
 * SSR hop's Set-Cookie never reaches the browser.
 *
 * Runs after `00.locale-market` and before `01.buyer-market` (filename order).
 */

// Routes that set or clear the auth cookies themselves (prefixes: `login`
// covers `login-as`, `preview` the preview enter and exit routes).
const OWN_COOKIES = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/preview',
  '/api/auth/refresh',
  '/api/auth/register',
];

export default defineEventHandler(async (event) => {
  const path = (event.path || '/').split('?')[0] ?? '/';

  if (!path.startsWith('/api/') && !isPagePath(path)) return;
  if (path.startsWith('/api/internal/') || path.startsWith('/api/health')) {
    return;
  }
  if (OWN_COOKIES.some((route) => path.startsWith(route))) return;
  // An unknown host still has to end at the tenant 404.
  if (event.context.tenantRefusal || !event.context.tenant?.hostname) return;

  try {
    await resolveSession(event);
  } catch {
    // Not decided: every consumer falls back to the request cookie.
  }
});
