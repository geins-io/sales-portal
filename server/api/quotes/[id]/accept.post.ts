import * as quotesService from '../../../services/quotes';
import {
  quoteRespondRateLimiter,
  getClientIp,
} from '../../../utils/rate-limiter';

export default defineEventHandler(async (event) => {
  await requireAuth(event);

  const { allowed } = await quoteRespondRateLimiter.check(getClientIp(event));
  if (!allowed) {
    throw createAppError(ErrorCode.RATE_LIMITED, 'Too many quote responses');
  }

  const id = getRouterParam(event, 'id');

  const quote = await quotesService.acceptQuote(id as string, event);

  return { quote };
});
