import * as authService from '../../services/auth';
import { rememberCartUnlessOthers } from '../../utils/cart-owner';

export default defineEventHandler(async (event) => {
  // A cart from before this browser noted carts is noted now, so the buyer
  // gets it back at the next sign-in. An expired token still names the buyer.
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
