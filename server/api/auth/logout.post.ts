import * as authService from '../../services/auth';

export default defineEventHandler(async (event) => {
  // Clear cookies first — always succeeds
  clearAuthCookies(event);
  clearSpoofedByCookie(event);
  clearPreviewCookie(event);
  // The next buyer in this browser never gets this cart; the owner note keeps
  // it for this buyer's next sign-in.
  clearCartCookie(event);

  // Best-effort server-side logout — don't fail if Geins API errors
  try {
    await authService.logout(event);
  } catch {
    // Ignore — cookies are already cleared
  }

  return { success: true };
});
