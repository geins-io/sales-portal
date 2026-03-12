import * as quotesService from '../../services/quotes';
import { ListQuotesSchema } from '../../schemas/api-input';
import { requirePermission } from '../../utils/b2b-auth';

export default defineEventHandler(async (event) => {
  const { buyer } = await requirePermission(event, 'quotes:view_own');

  const query = await getValidatedQuery(event, ListQuotesSchema.parse);

  const result = await quotesService.listQuotes(
    buyer.organizationId,
    query.skip,
    query.take,
    event,
  );

  return result;
});
