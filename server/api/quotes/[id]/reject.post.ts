import * as quotesService from '../../../services/quotes';
import { RejectQuoteSchema } from '../../../schemas/api-input';
import { requirePermission } from '../../../utils/b2b-auth';

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'quotes:reject');

  const id = getRouterParam(event, 'id');

  const body = await readValidatedBody(event, RejectQuoteSchema.parse);

  const quote = await quotesService.rejectQuote(
    id as string,
    body.reason,
    event,
  );

  return { quote };
});
