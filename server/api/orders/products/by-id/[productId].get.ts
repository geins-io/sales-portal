import * as purchasedProductsService from '../../../../services/purchased-products';
import { requireAuth } from '../../../../utils/auth';
import { ProductIdSchema } from '../../../../schemas/api-input';

/**
 * The company's newest order holding the product, or `{ order: null }` when
 * it never ordered it. Geins filters orders by no product, so the whole order
 * history is read, holding nothing but each line's product id.
 *
 * Private and short-lived: the answer is per buyer and changes the moment
 * they order, and five minutes still shows a quick reorder on the next visit.
 */
export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const { productId } = await getValidatedRouterParams(
    event,
    ProductIdSchema.parse,
  );

  return withErrorHandling(
    async () => {
      const order = await purchasedProductsService.getLatestOrderForProduct(
        event,
        productId,
      );
      // Only on success: a cached error would come back on the next visit.
      setResponseHeader(
        event,
        'Cache-Control',
        'private, max-age=300, must-revalidate',
      );
      return { order };
    },
    { operation: 'orders.products.byId' },
  );
});
