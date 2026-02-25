import { ProductReviewsSchema } from '../../../schemas/api-input';
import { getReviews } from '../../../services/products';

export default defineEventHandler(async (event) => {
  const alias = getRouterParam(event, 'alias');
  const query = getQuery(event);
  const validated = ProductReviewsSchema.parse({ alias, ...query });

  return withErrorHandling(
    async () => {
      return getReviews(validated, event);
    },
    { operation: 'products.reviews.get' },
  );
});
