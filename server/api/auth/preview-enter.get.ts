import { isSafeInternalPath } from '#shared/utils/redirect';

/**
 * Preview entry — browser hits this URL directly (not via internal fetch).
 * Sets preview cookies and redirects to the storefront.
 *
 * Usage: /api/auth/preview-enter?loginToken=JWT&redirect=/se/sv/
 *
 * This is a GET endpoint because the browser navigates to it directly.
 * The loginToken is a short-lived JWT from the CMS Studio — it's safe
 * in a URL param since it's a one-time use token over HTTPS.
 */
export default defineEventHandler((event) => {
  const query = getQuery(event);
  const loginToken = query.loginToken as string | undefined;

  if (!loginToken) {
    throw createAppError(ErrorCode.BAD_REQUEST, 'Missing loginToken');
  }

  // Clear any existing auth session and set preview cookies
  clearAuthCookies(event);
  setPreviewAuthToken(event, loginToken);
  setPreviewCookie(event);

  // Redirect to the specified path or home. The shared validator rejects
  // external and protocol-relative URLs (including //evil.com, /\evil.com,
  // javascript:...) so this endpoint can't be used as an open-redirect.
  const redirectPath = query.redirect;
  const safePath = isSafeInternalPath(redirectPath) ? redirectPath : '/';

  return sendRedirect(event, safePath, 302);
});
