import { ProductReviewsSchema } from '../../../schemas/api-input';
import { getReviews } from '../../../services/products';

export default defineEventHandler(async (event) => {
  const alias = getRouterParam(event, 'alias');
  const validated = await getValidatedQuery(event, (q) =>
    ProductReviewsSchema.parse({ alias, ...(q as Record<string, unknown>) }),
  );

  return withErrorHandling(
    async () => {
      return getReviews(validated, event);
    },
    { operation: 'products.reviews.get' },
  );
});
