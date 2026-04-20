import { z } from 'zod';
import { getProductsByAliases } from '../../services/products';

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
    .pipe(z.array(z.string().min(1).max(200)).min(1).max(50)),
});

export default defineEventHandler(async (event) => {
  const { aliases } = await getValidatedQuery(event, (raw) =>
    ByAliasesQuerySchema.parse(raw),
  );
  const auth = await optionalAuth(event);

  setResponseHeader(event, 'Cache-Control', 'private, no-cache');

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
