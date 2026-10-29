import * as authService from '../../services/auth';
import * as cartService from '../../services/cart';
import { loginRateLimiter, getClientIp } from '../../utils/rate-limiter';
import { LoginSchema } from '../../schemas/api-input';
import { resolveBuyerMarket } from '../../utils/buyer-market-resolver';
import {
  buyerIdOf,
  cartAtSignIn,
  readCartOwners,
  rememberCart,
} from '../../utils/cart-owner';

export default defineEventHandler(async (event) => {
  const clientIp = getClientIp(event);
  const rateLimit = await loginRateLimiter.check(clientIp);

  if (!rateLimit.allowed) {
    throw createAppError(ErrorCode.RATE_LIMITED, 'Too many login attempts');
  }

  const body = await readValidatedBody(event, LoginSchema.parse);

  const result = await authService.login(
    { username: body.username, password: body.password },
    event,
  );

  if (
    !result?.succeeded ||
    !result.tokens?.token ||
    !result.tokens?.refreshToken
  ) {
    throw createAppError(ErrorCode.UNAUTHORIZED, 'Invalid credentials');
  }

  // Only failed attempts count against the limit.
  await loginRateLimiter.refund(clientIp);

  const { tokens, user } = result;

  // Set httpOnly cookies — tokens never reach the client
  setAuthCookies(event, {
    token: tokens.token!,
    refreshToken: tokens.refreshToken!,
    expiresIn: tokens.expiresIn,
    // Explicit either way, so a mark left by an earlier sign-in is replaced.
    rememberMe: body.rememberMe !== false,
  });

  // The buyer's own cart when this browser noted one; otherwise a guest cart
  // is copied into a new authenticated cart, as before. Another buyer's cart
  // is never copied.
  const signIn = cartAtSignIn(
    getCartCookie(event),
    buyerIdOf(tokens.token),
    readCartOwners(event),
  );
  if (signIn.kind === 'keep') {
    setCartCookie(event, signIn.cartId);
    // Written again, so a buyer who only signs in is not the one evicted.
    rememberCart(event, tokens.token, signIn.cartId);
  } else if (signIn.kind === 'copy') {
    try {
      const newCart = await cartService.copyCart(
        signIn.cartId,
        event,
        tokens.token!,
      );
      setCartCookie(event, newCart.id);
      rememberCart(event, tokens.token, newCart.id);
    } catch {
      // A refused copy must not fail the sign-in: a new cart on the first add.
      clearCartCookie(event);
    }
  } else {
    clearCartCookie(event);
  }

  // Land the buyer on the market whose country matches their company's
  // delivery address, so Geins's catalog resolves to a currency they can see
  // prices in. The freshly minted auth cookie is on the response, not the
  // inbound request, so the token is passed explicitly.
  const resolvedMarket = await resolveBuyerMarket(event, tokens.token!).catch(
    () => null,
  );

  return {
    user,
    expiresAt: tokens.expiresIn
      ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString()
      : null,
    market: resolvedMarket,
  };
});
