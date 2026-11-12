import { addToDraft } from '../../../services/quotes';
import { QuoteDraftLineSchema } from '../../../schemas/api-input';
import { assertFeatureAccess } from '../../../utils/feature-access';
import {
  quoteDraftRateLimiter,
  getClientIp,
} from '../../../utils/rate-limiter';

/** A product added to a request draft from its page: a plain line by its SKU. */
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

  const line = await readValidatedBody(event, QuoteDraftLineSchema.parse);
  const id = getRouterParam(event, 'id');

  const quote = await addToDraft(id as string, line, event);
  return { quote };
});
