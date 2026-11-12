import { addToDraft } from '../../../services/quotes';
import { QuoteDraftLineSchema } from '../../../schemas/api-input';
import { assertQuoteRequestAccess } from '../../../utils/feature-access';
import {
  quoteDraftRateLimiter,
  getClientIp,
} from '../../../utils/rate-limiter';

/** A product added to a request draft from its page: a plain line by its SKU. */
export default defineEventHandler(async (event) => {
  await requireAuth(event);

  await assertQuoteRequestAccess(event);

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
