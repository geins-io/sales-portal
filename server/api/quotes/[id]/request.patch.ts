import * as quotesService from '../../../services/quotes';
import { UpdateQuoteRequestSchema } from '../../../schemas/api-input';
import {
  quoteDraftRateLimiter,
  getClientIp,
} from '../../../utils/rate-limiter';
import { assertQuoteRequestAccess } from '../../../utils/feature-access';

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

  const details = await readValidatedBody(
    event,
    UpdateQuoteRequestSchema.parse,
  );
  const id = getRouterParam(event, 'id');

  const quote = await quotesService.updateQuoteRequest(
    id as string,
    details,
    event,
  );

  return { quote };
});
