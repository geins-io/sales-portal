import { getPendingOverview } from '../../services/quotes';

/** The start page's pending quotations. */
export default defineEventHandler(async (event) => {
  await requireAuth(event);

  setHeader(event, 'Cache-Control', 'private, no-cache');

  return getPendingOverview(event);
});
