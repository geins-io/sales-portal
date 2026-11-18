import { listQuotes } from '../../services/quotes';
import { ListQuotesSchema } from '../../schemas/api-input';

/** One page of the buyer's quotations, for the list. */
export default defineEventHandler(async (event) => {
  await requireAuth(event);

  const query = await getValidatedQuery(event, ListQuotesSchema.parse);

  setHeader(event, 'Cache-Control', 'private, no-cache');

  return listQuotes(query, event);
});
