import * as quotesService from '../../services/quotes';
import { getCart } from '../../services/cart';
import { CreateQuoteRequestSchema } from '../../schemas/api-input';
import { forgetCart } from '../../utils/cart-owner';
import { quoteRespondRateLimiter, getClientIp } from '../../utils/rate-limiter';
import { assertFeatureAccess } from '../../utils/feature-access';

export default defineEventHandler(async (event) => {
  await requireAuth(event);

  // The same rule as the cart button, so the switch holds outside the UI.
  const signedIn = { authenticated: true };
  await assertFeatureAccess(event, 'quotes', signedIn);
  await assertFeatureAccess(event, 'quoteRequests', signedIn);

  const { allowed } = await quoteRespondRateLimiter.check(getClientIp(event));
  if (!allowed) {
    throw createAppError(ErrorCode.RATE_LIMITED, 'Too many quote responses');
  }

  const { name } = await readValidatedBody(
    event,
    CreateQuoteRequestSchema.parse,
  );

  const cartId = getCartCookie(event);
  if (!cartId) {
    throw createAppError(
      ErrorCode.EMPTY_CART,
      'No cart to request a quote for',
    );
  }
  const cart = await getCart(cartId, event);
  if (!cart?.items?.length) {
    throw createAppError(ErrorCode.EMPTY_CART, 'Cart has no items', { cartId });
  }

  const quote = await quotesService.createQuoteRequest(cartId, name, event);

  // Geins copies the lines and leaves the cart as it is. The request has its
  // own id, so the cart is let go and the buyer's next add starts a new one.
  // The caller resets the client cart store: its useCookie ref is not
  // refreshed from Set-Cookie and would keep sending the old cart id.
  forgetCart(event, getSessionToken(event), cartId);
  clearCartCookie(event);

  return { quote };
});
