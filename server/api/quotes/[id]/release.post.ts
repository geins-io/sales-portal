import * as quotesService from '../../../services/quotes';
import {
  quoteRespondRateLimiter,
  getClientIp,
} from '../../../utils/rate-limiter';
import { assertQuoteRequestAccess } from '../../../utils/feature-access';

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  await assertQuoteRequestAccess(event);

  const { allowed } = await quoteRespondRateLimiter.check(getClientIp(event));
  if (!allowed) {
    throw createAppError(ErrorCode.RATE_LIMITED, 'Too many quote responses');
  }

  const id = getRouterParam(event, 'id');

  const quote = await quotesService.releaseQuoteRequest(id as string, event);

  return { quote };
});
