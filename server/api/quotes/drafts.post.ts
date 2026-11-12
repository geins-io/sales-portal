import { createDraftWith, placePlainLine } from '../../services/quotes';
import { NewQuoteDraftSchema } from '../../schemas/api-input';
import { assertFeatureAccess } from '../../utils/feature-access';
import { quoteDraftRateLimiter, getClientIp } from '../../utils/rate-limiter';

/**
 * A new request draft with a product from its page. The draft is made from a
 * cart of its own, so the buyer's cart stays as it is.
 */
export default defineEventHandler(async (event) => {
  await requireAuth(event);

  const signedIn = { authenticated: true };
  await assertFeatureAccess(event, 'quotes', signedIn);
  await assertFeatureAccess(event, 'quoteRequests', signedIn);

  const { allowed } = await quoteDraftRateLimiter.check(getClientIp(event));
  if (!allowed) {
    throw createAppError(
      ErrorCode.RATE_LIMITED,
      'Too many quote draft changes',
    );
  }

  const { name, skuId, quantity } = await readValidatedBody(
    event,
    NewQuoteDraftSchema.parse,
  );

  const quote = await createDraftWith(
    name,
    (cartId) => placePlainLine(cartId, { skuId, quantity }, event),
    event,
  );
  return { quote };
});
