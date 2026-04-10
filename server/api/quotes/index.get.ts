import * as quotesService from '../../services/quotes';
import { ListQuotesSchema } from '../../schemas/api-input';

export default defineEventHandler(async (event) => {
  await requireAuth(event);

  const query = await getValidatedQuery(event, ListQuotesSchema.parse);

  setHeader(event, 'Cache-Control', 'private, no-cache');

  return quotesService.listQuotes('', query.skip, query.take, event);
});
