import { listQuoteNames } from '../../services/quotes';
import { QuoteNamesSchema } from '../../schemas/api-input';

/** The names of the buyer's quotations a search finds. */
export default defineEventHandler(async (event) => {
  await requireAuth(event);

  const { search } = await getValidatedQuery(event, QuoteNamesSchema.parse);

  setHeader(event, 'Cache-Control', 'private, no-cache');

  return { names: await listQuoteNames(search, event) };
});
