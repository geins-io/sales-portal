import * as quotesService from '../../../services/quotes';
import { FinalizeQuoteSchema } from '../../../schemas/api-input';
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

  const options = await readValidatedBody(event, FinalizeQuoteSchema.parse);
  const id = getRouterParam(event, 'id');

  const quote = await quotesService.finalizeQuote(id as string, event, options);

  return { quote };
});
