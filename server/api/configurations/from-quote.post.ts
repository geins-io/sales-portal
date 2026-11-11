import { QuoteLineOfProductSchema } from '../../schemas/api-input';
import { replayQuoteLine } from '../../services/configurator-replay';
import { getQuoteLineChoices } from '../../services/quotes';
import { requireConfigurator } from '../../utils/configurator-route';

/** A new session holding a configured draft line's choices, when they still fit. */
export default defineEventHandler(async (event) => {
  const { backend, ctx } = await requireConfigurator(event);
  const { productId, quoteId, lineId } = await readValidatedBody(
    event,
    QuoteLineOfProductSchema.parse,
  );

  return withErrorHandling(
    () =>
      replayQuoteLine(
        backend,
        {
          productId,
          read: () => getQuoteLineChoices(quoteId, lineId, event),
        },
        ctx,
      ),
    { operation: 'configurator.fromQuote' },
  );
});
