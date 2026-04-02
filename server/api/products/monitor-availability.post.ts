import { MonitorAvailabilitySchema } from '../../schemas/api-input';
import { monitorAvailability } from '../../services/products';
import {
  monitorAvailabilityRateLimiter,
  getClientIp,
} from '../../utils/rate-limiter';

export default defineEventHandler(async (event) => {
  const clientIp = getClientIp(event);
  const rateLimit = await monitorAvailabilityRateLimiter.check(clientIp);

  if (!rateLimit.allowed) {
    throw createAppError(
      ErrorCode.RATE_LIMITED,
      'Too many availability monitor requests',
    );
  }

  const validated = await readValidatedBody(event, (raw) =>
    MonitorAvailabilitySchema.parse(raw),
  );

  const auth = await optionalAuth(event);

  return withErrorHandling(
    async () => {
      return monitorAvailability(
        { ...validated, userToken: auth?.authToken },
        event,
      );
    },
    { operation: 'products.monitorAvailability.post' },
  );
});
