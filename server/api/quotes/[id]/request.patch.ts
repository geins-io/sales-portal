import * as quotesService from '../../../services/quotes';
import { UpdateQuoteRequestSchema } from '../../../schemas/api-input';
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
