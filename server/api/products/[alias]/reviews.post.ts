import { PostReviewSchema } from '../../../schemas/api-input';
import { postReview } from '../../../services/products';

export default defineEventHandler(async (event) => {
  const alias = getRouterParam(event, 'alias');
  const validated = await readValidatedBody(event, (raw) =>
    PostReviewSchema.parse({ alias, ...(raw as Record<string, unknown>) }),
  );

  return withErrorHandling(
    async () => {
      return postReview(validated, event);
    },
    { operation: 'products.reviews.post' },
  );
});
