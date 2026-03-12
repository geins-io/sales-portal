import * as quotesService from '../../services/quotes';
import { CreateQuoteSchema } from '../../schemas/api-input';
import { requirePermission } from '../../utils/b2b-auth';
import { quoteCreateRateLimiter, getClientIp } from '../../utils/rate-limiter';

export default defineEventHandler(async (event) => {
  const { buyer } = await requirePermission(event, 'quotes:create');

  const ip = getClientIp(event);
  const { allowed } = await quoteCreateRateLimiter.check(ip);
  if (!allowed) {
    throw createAppError(
      ErrorCode.RATE_LIMITED,
      'Too many quote creation attempts',
    );
  }

  const body = await readValidatedBody(event, CreateQuoteSchema.parse);

  const quote = await quotesService.createQuote(
    buyer.organizationId,
    buyer.userId,
    `${buyer.firstName} ${buyer.lastName}`,
    buyer.email,
    [],
    body.message,
    body.poNumber,
    body.paymentTerms,
    event,
  );

  return { quote };
});
