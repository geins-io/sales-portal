import { ConfiguredQuoteAddSchema } from '../../../schemas/api-input';
import { addItem } from '../../../services/cart';
import { addToDraft, createDraftWith } from '../../../services/quotes';
import {
  configurationIdFrom,
  requireConfigurator,
} from '../../../utils/configurator-route';
import { assertQuoteRequestAccess } from '../../../utils/feature-access';
import {
  getClientIp,
  quoteDraftRateLimiter,
} from '../../../utils/rate-limiter';

/**
 * Commits the session `:id` as a new configured line of a request draft, or of
 * a new draft by its name. The commit is made here, as for a draft line: Geins
 * takes any committed id at any amount, so only one this request committed is
 * known to be the buyer's, at its amount.
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
  const target = await readValidatedBody(event, ConfiguredQuoteAddSchema.parse);
  const { skuId } = target;

  /** The session committed, as the line the draft takes. */
  const commitLine = async () => {
    const { committedConfigurationId, quantity } = await backend.commit(
      sessionId,
      ctx,
    );
    return { skuId, quantity, configurationId: committedConfigurationId };
  };

  const quote = await withErrorHandling(
    () =>
      'quoteId' in target
        ? addToDraft(target.quoteId, commitLine, event)
        : createDraftWith(
            target.name,
            async (cartId) => {
              const line = await commitLine();
              await backend.addToCart(
                cartId,
                {
                  committedConfigurationId: line.configurationId,
                  skuId,
                  quantity: line.quantity,
                },
                {
                  ...ctx,
                  cart: {
                    addPlainItem: (id, item) => addItem(id, item, event),
                  },
                },
              );
              return line;
            },
            event,
          ),
    { operation: 'configurator.addToQuote' },
  );
  return { quote };
});
