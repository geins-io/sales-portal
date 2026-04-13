import { isSafeInternalPath } from '#shared/utils/redirect';

/**
 * Login-as-customer — admin impersonation entry point.
 *
 * Geins Admin navigates the browser to:
 *   /account?loginToken=eyJhbG...
 *
 * The account page redirects here. This endpoint:
 * 1. Validates the JWT format (not crypto — Geins signs it)
 * 2. Sets the auth token cookie
 * 3. If SpoofedBy claim is present, sets the impersonation cookie
 * 4. Redirects to /portal (or a custom redirect path)
 */
export default defineEventHandler((event) => {
  const query = getQuery(event);
  const loginToken = query.loginToken as string | undefined;

  if (!loginToken) {
    throw createAppError(ErrorCode.BAD_REQUEST, 'Missing loginToken');
  }

  // Basic JWT format check: three dot-separated base64 segments
  const parts = loginToken.split('.');
  if (parts.length !== 3) {
    throw createAppError(ErrorCode.BAD_REQUEST, 'Invalid loginToken format');
  }

  // Decode payload to check for SpoofedBy claim
  const spoofedBy = decodeSpoofedBy(loginToken);

  // Set the auth token cookie (same approach as preview-enter)
  setPreviewAuthToken(event, loginToken);

  // If this is an admin impersonation, set the spoofed-by cookie
  if (spoofedBy) {
    setSpoofedByCookie(event, spoofedBy);
  }

  // Redirect to the specified path or /portal. The shared validator rejects
  // external and protocol-relative URLs (including //evil.com, /\evil.com,
  // javascript:...) so this endpoint can't be used as an open-redirect.
  const redirectPath = query.redirect;
  const safePath = isSafeInternalPath(redirectPath) ? redirectPath : '/portal';

  return sendRedirect(event, safePath, 302);
});

/**
 * Decode JWT payload and extract SpoofedBy claim if present.
 * Does NOT verify the signature — Geins is the signer.
 */
function decodeSpoofedBy(token: string): string | undefined {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return undefined;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    return payload.SpoofedBy as string | undefined;
  } catch {
    return undefined;
  }
}
