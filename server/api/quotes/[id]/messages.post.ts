import { createQuoteMessage } from '../../../services/quote-thread';
import {
  QuoteIdParamsSchema,
  QuoteMessageSchema,
} from '../../../schemas/api-input';
import {
  quoteMessageRateLimiter,
  getClientIp,
} from '../../../utils/rate-limiter';
import { assertQuoteConversationAccess } from '../../../utils/feature-access';

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  await assertQuoteConversationAccess(event);

  const { allowed } = await quoteMessageRateLimiter.check(getClientIp(event));
  if (!allowed) {
    throw createAppError(ErrorCode.RATE_LIMITED, 'Too many quote messages');
  }

  const { id } = await getValidatedRouterParams(
    event,
    QuoteIdParamsSchema.parse,
  );
  const input = await readValidatedBody(event, QuoteMessageSchema.parse);

  const message = await createQuoteMessage(id, input, event);

  return { message };
});
