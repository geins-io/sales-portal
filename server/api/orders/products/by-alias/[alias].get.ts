import * as purchasedProductsService from '../../../../services/purchased-products';
import { requireAuth } from '../../../../utils/auth';
import { ProductAliasSchema } from '../../../../schemas/api-input';

/**
 * Returns the purchased-product summary entry matching a single
 * product alias, or `{ product: null }` when the authenticated user
 * has never ordered this product.
 *
 * Geins's GraphQL surface has no per-product order filter (verified
 * via live introspection — `getOrders`, `getOrder`, `getOrderPublic`,
 * `getCompanyOrders` accept only channel/lang/market). The PDP needs
 * a tiny "Latest ordered" row, so we reuse the aggregation that
 * powers `/api/orders/products` and return the matching row.
 *
 * Caching is private and short-lived: the data is per-user and
 * changes the moment they place an order. Five minutes matches the
 * list endpoint and is short enough that a quick reorder still sees
 * the updated timestamp on the next PDP visit.
 */
export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const aliasParam = getRouterParam(event, 'alias');
  const { alias } = ProductAliasSchema.parse({ alias: aliasParam });

  setResponseHeader(
    event,
    'Cache-Control',
    'private, max-age=300, must-revalidate',
  );

  return withErrorHandling(
    async () => {
      const { products } =
        await purchasedProductsService.getPurchasedProducts(event);
      const product = products.find((p) => p.alias === alias) ?? null;
      return { product };
    },
    { operation: 'orders.products.byAlias' },
  );
});
