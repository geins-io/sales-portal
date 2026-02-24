import { PostReviewSchema } from '../../../schemas/api-input';
import { postReview } from '../../../services/products';

export default defineEventHandler(async (event) => {
  const alias = getRouterParam(event, 'alias');
  const body = await readBody(event);
  const validated = PostReviewSchema.parse({ alias, ...body });

  return withErrorHandling(
    async () => {
      return postReview(validated, event);
    },
    { operation: 'products.reviews.post' },
  );
});
