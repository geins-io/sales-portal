import { createQuoteMessage } from '../../../services/quote-thread';
import { QuoteMessageSchema } from '../../../schemas/api-input';
import {
  quoteMessageRateLimiter,
  getClientIp,
} from '../../../utils/rate-limiter';

export default defineEventHandler(async (event) => {
  await requireAuth(event);

  const { allowed } = await quoteMessageRateLimiter.check(getClientIp(event));
  if (!allowed) {
    throw createAppError(ErrorCode.RATE_LIMITED, 'Too many quote messages');
  }

  const input = await readValidatedBody(event, QuoteMessageSchema.parse);
  const id = getRouterParam(event, 'id');

  const message = await createQuoteMessage(id as string, input, event);

  return { message };
});
