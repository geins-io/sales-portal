import * as quotesService from '../../services/quotes';

export default defineEventHandler(async (event) => {
  await requireAuth(event);

  const id = getRouterParam(event, 'id');

  setHeader(event, 'Cache-Control', 'private, no-cache');

  const quote = await quotesService.getQuote(id as string, event);

  return { quote };
});
