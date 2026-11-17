import { getQuoteThread } from '../../../services/quote-thread';
import { QuoteIdParamsSchema } from '../../../schemas/api-input';

export default defineEventHandler(async (event) => {
  await requireAuth(event);

  const { id } = await getValidatedRouterParams(
    event,
    QuoteIdParamsSchema.parse,
  );

  setHeader(event, 'Cache-Control', 'private, no-cache');

  const thread = await getQuoteThread(id, event);

  return { thread };
});
