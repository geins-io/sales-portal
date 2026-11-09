import * as quotesService from '../../../services/quotes';

/** Whether the buyer can open the quotation, by reading its number. */
export default defineEventHandler(async (event) => {
  await requireAuth(event);

  const id = getRouterParam(event, 'id');

  setHeader(event, 'Cache-Control', 'private, no-cache');

  const number = await quotesService.getQuoteNumber(id as string, event);

  return { number };
});
