import * as authService from '../../services/auth';
import { rememberCartUnlessOthers } from '../../utils/cart-owner';

export default defineEventHandler(async (event) => {
  // A cart from before carts were noted is noted now, for the next sign-in;
  // only while the browser still sends auth_token, expired or not.
  const cartId = getCartCookie(event);
  if (cartId) rememberCartUnlessOthers(event, getSessionToken(event), cartId);

  // Clear the session cookies — always succeeds
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
