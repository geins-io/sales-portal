import { z } from 'zod';
import { getProductsByIds } from '../../services/products';

// Product IDs are forwarded to GraphQL as the `productIds` filter (variables,
// not string-concatenated). The 600 ceiling matches Geins's own filter cap, so
// even the largest variant groups resolve in a single request.
const ByIdsQuerySchema = z.object({
  ids: z
    .string()
    .min(1)
    .transform((s) =>
      s
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
        .map(Number),
    )
    .pipe(z.array(z.number().int().positive()).min(1).max(600)),
});

export default defineEventHandler(async (event) => {
  const { ids } = await getValidatedQuery(event, (raw) =>
    ByIdsQuerySchema.parse(raw),
  );
  const auth = await optionalAuth(event);

  // Match the product-listing endpoints' auth-aware cache strategy. Anonymous
  // requests can be edge-cached briefly, signed-in requests are per-user.
  setResponseHeader(
    event,
    'Cache-Control',
    auth?.authToken
      ? 'private, no-cache'
      : 'public, s-maxage=60, stale-while-revalidate=600',
  );

  return withErrorHandling(
    async () => {
      return await getProductsByIds(
        { productIds: ids, userToken: auth?.authToken },
        event,
      );
    },
    { operation: 'products.by-ids' },
  );
});
