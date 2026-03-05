import { PostReviewSchema } from '../../../schemas/api-input';
import { postReview } from '../../../services/products';

export default defineEventHandler(async (event) => {
  const alias = getRouterParam(event, 'alias');
  const validated = await readValidatedBody(event, (raw) =>
    PostReviewSchema.parse({ alias, ...(raw as Record<string, unknown>) }),
  );

  const auth = await optionalAuth(event);

  return withErrorHandling(
    async () => {
      return postReview({ ...validated, userToken: auth?.authToken }, event);
    },
    { operation: 'products.reviews.post' },
  );
});
