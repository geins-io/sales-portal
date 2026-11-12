import { QuoteLineOfProductSchema } from '../../../schemas/api-input';
import { replaceConfiguredLine } from '../../../services/quotes';
import {
  configurationIdFrom,
  requireConfigurator,
} from '../../../utils/configurator-route';
import {
  getClientIp,
  quoteDraftRateLimiter,
} from '../../../utils/rate-limiter';
import { assertQuoteRequestAccess } from '../../../utils/feature-access';

/**
 * Commits the session `:id` onto a configured line of a quotation draft. The
 * commit is made here, not by the page: Geins takes any committed id at any
 * amount on a draft line and a committed id cannot be read back, so only one
 * this request committed is known to be the buyer's, at its amount. The
 * product is the one the page shows, which must be the line's: a session
 * carries no product id to hold against it.
 */
export default defineEventHandler(async (event) => {
  const { backend, ctx } = await requireConfigurator(event);
  await assertQuoteRequestAccess(event);

  const { allowed } = await quoteDraftRateLimiter.check(getClientIp(event));
  if (!allowed) {
    throw createAppError(
      ErrorCode.RATE_LIMITED,
      'Too many quote draft changes',
    );
  }

  const sessionId = configurationIdFrom(event);
  const { productId, quoteId, lineId } = await readValidatedBody(
    event,
    QuoteLineOfProductSchema.parse,
  );

  const quote = await withErrorHandling(
    () =>
      replaceConfiguredLine(
        quoteId,
        lineId,
        productId,
        () => backend.commit(sessionId, ctx),
        event,
      ),
    { operation: 'configurator.replaceQuoteLine' },
  );
  return { quote };
});
