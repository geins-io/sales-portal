import { z } from 'zod';
import { withConfigurableFlags } from '../../services/configurator';
import { getProductsByAliases } from '../../services/products';

type FavoriteProducts = { productId?: number; type?: string | null }[];

// Aliases come from client-stored favorites and are forwarded to GraphQL as
// variables (not concatenated into the query). Matches the single-product
// endpoint's ProductAliasSchema so any alias resolvable via /api/products/:alias
// is also resolvable here.
const aliasItem = z.string().min(1).max(200);

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

  return withErrorHandling(
    async () => {
      const products = (await getProductsByAliases(
        { aliases, userToken: auth?.authToken },
        event,
      )) as FavoriteProducts;
      // Match the single-product endpoint's auth-aware cache strategy.
      // Anonymous answers can be edge-cached briefly, signed-in ones are
      // per-user. Only on success: a cached failure would come back.
      setResponseHeader(
        event,
        'Cache-Control',
        auth?.authToken
          ? 'private, no-cache'
          : 'public, s-maxage=60, stale-while-revalidate=600',
      );
      return { products: withConfigurableFlags(event, products) };
    },
    { operation: 'products.by-aliases' },
  );
});
