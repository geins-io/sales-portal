import * as quotesService from '../../../services/quotes';
import { RejectQuoteSchema } from '../../../schemas/api-input';

export default defineEventHandler(async (event) => {
  await requireAuth(event);

  const id = getRouterParam(event, 'id');

  const body = await readValidatedBody(event, RejectQuoteSchema.parse);

  const quote = await quotesService.rejectQuote(
    id as string,
    body.reason,
    event,
  );

  return { quote };
});
