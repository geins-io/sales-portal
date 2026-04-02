import { CartPromoCodeSchema } from '../../schemas/api-input';
import { applyPromoCode } from '../../services/cart';
import { promoCodeRateLimiter, getClientIp } from '../../utils/rate-limiter';

export default defineEventHandler(async (event) => {
  const clientIp = getClientIp(event);
  const rateLimit = await promoCodeRateLimiter.check(clientIp);

  if (!rateLimit.allowed) {
    throw createAppError(
      ErrorCode.RATE_LIMITED,
      'Too many promo code attempts',
    );
  }

  const body = await readValidatedBody(event, CartPromoCodeSchema.parse);

  return withErrorHandling(
    async () => {
      return await applyPromoCode(body.cartId, body.promoCode, event);
    },
    { operation: 'cart.applyPromoCode' },
  );
});
