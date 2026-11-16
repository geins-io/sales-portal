import { getQuoteThread } from '../../../services/quote-thread';

export default defineEventHandler(async (event) => {
  await requireAuth(event);

  const id = getRouterParam(event, 'id');

  setHeader(event, 'Cache-Control', 'private, no-cache');

  const thread = await getQuoteThread(id as string, event);

  return { thread };
});
