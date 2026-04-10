import * as quotesService from '../../../services/quotes';

export default defineEventHandler(async (event) => {
  await requireAuth(event);

  const id = getRouterParam(event, 'id');

  const quote = await quotesService.acceptQuote(id as string, event);

  return { quote };
});
