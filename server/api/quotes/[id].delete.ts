import * as quotesService from '../../services/quotes';
import { quoteDraftRateLimiter, getClientIp } from '../../utils/rate-limiter';

export default defineEventHandler(async (event) => {
  await requireAuth(event);

  const { allowed } = await quoteDraftRateLimiter.check(getClientIp(event));
  if (!allowed) {
    throw createAppError(
      ErrorCode.RATE_LIMITED,
      'Too many quote draft changes',
    );
  }

  const id = getRouterParam(event, 'id');
  await quotesService.deleteQuoteRequest(id as string, event);

  return { deleted: true };
});
