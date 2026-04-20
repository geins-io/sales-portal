import { z } from 'zod';
import { getProductsByAliases } from '../../services/products';

// Aliases come from client-stored favorites and are forwarded to GraphQL as
// variables (not concatenated into the query). The regex restricts to
// product-alias-safe characters as a defense-in-depth check.
const aliasItem = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-zA-Z0-9_-]+$/);

const ByAliasesQuerySchema = z.object({
  aliases: z
    .string()
    .min(1)
    .transform((s) =>
      s
        .split(',')
        .map((a) => a.trim())
        .filter((a) => a.length > 0),
    )
    .pipe(z.array(aliasItem).min(1).max(50)),
});

export default defineEventHandler(async (event) => {
  const { aliases } = await getValidatedQuery(event, (raw) =>
    ByAliasesQuerySchema.parse(raw),
  );
  const auth = await optionalAuth(event);

  // Match the single-product endpoint's auth-aware cache strategy. Anonymous
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
      const products = await getProductsByAliases(
        { aliases, userToken: auth?.authToken },
        event,
      );
      return { products };
    },
    { operation: 'products.by-aliases' },
  );
});
