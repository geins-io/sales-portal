import * as quotesService from '../../../services/quotes';
import { QuoteAnswerSchema } from '../../../schemas/api-input';
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

  const options = await readValidatedBody(event, QuoteAnswerSchema.parse);
  const id = getRouterParam(event, 'id');

  const quote = await quotesService.rejectQuote(id as string, event, options);

  return { quote };
});
