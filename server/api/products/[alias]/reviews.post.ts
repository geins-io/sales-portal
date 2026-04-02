import { PostReviewSchema } from '../../../schemas/api-input';
import { postReview } from '../../../services/products';
import {
  reviewPostRateLimiter,
  getClientIp,
} from '../../../utils/rate-limiter';

export default defineEventHandler(async (event) => {
  const clientIp = getClientIp(event);
  const rateLimit = await reviewPostRateLimiter.check(clientIp);

  if (!rateLimit.allowed) {
    throw createAppError(ErrorCode.RATE_LIMITED, 'Too many review submissions');
  }

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
