import { ProductListSchema } from '../../schemas/api-input';
import { withConfigurableFlags } from '../../services/configurator';
import { getProducts } from '../../services/product-lists';

type ProductListResult = {
  products?: { productId?: number; type?: string | null }[] | null;
} | null;

export default defineEventHandler(async (event) => {
  const validated = await getValidatedQuery(event, ProductListSchema.parse);
  const auth = await optionalAuth(event);

  setResponseHeader(
    event,
    'Cache-Control',
    auth?.authToken
      ? 'private, no-cache'
      : 'public, s-maxage=60, stale-while-revalidate=600',
  );

  return withErrorHandling(
    async () => {
      const list = (await getProducts(
        { ...validated, userToken: auth?.authToken },
        event,
      )) as ProductListResult;
      return list?.products
        ? { ...list, products: withConfigurableFlags(event, list.products) }
        : list;
    },
    { operation: 'product-lists.products.get' },
  );
});
