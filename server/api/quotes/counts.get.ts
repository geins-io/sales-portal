import { countQuotes } from '../../services/quotes';

/** How many quotations each tab of the list holds. */
export default defineEventHandler(async (event) => {
  await requireAuth(event);

  setHeader(event, 'Cache-Control', 'private, no-cache');

  return { counts: await countQuotes(event) };
});
