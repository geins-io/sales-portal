import { deleteQuoteMessage } from '../../../../services/quote-thread';
import { QuoteMessageParamsSchema } from '../../../../schemas/api-input';
import {
  quoteMessageRateLimiter,
  getClientIp,
} from '../../../../utils/rate-limiter';
import { assertQuoteConversationAccess } from '../../../../utils/feature-access';

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  await assertQuoteConversationAccess(event);

  const { allowed } = await quoteMessageRateLimiter.check(getClientIp(event));
  if (!allowed) {
    throw createAppError(ErrorCode.RATE_LIMITED, 'Too many quote messages');
  }

  const { id, messageId } = await getValidatedRouterParams(
    event,
    QuoteMessageParamsSchema.parse,
  );

  await deleteQuoteMessage(id, messageId, event);

  return { deleted: true };
});
