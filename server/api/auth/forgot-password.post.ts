import * as userService from '../../services/user';
import {
  forgotPasswordRateLimiter,
  getClientIp,
} from '../../utils/rate-limiter';
import { ForgotPasswordSchema } from '../../schemas/api-input';

export default defineEventHandler(async (event) => {
  const clientIp = getClientIp(event);
  const rateLimit = await forgotPasswordRateLimiter.check(clientIp);

  if (!rateLimit.allowed) {
    throw createAppError(
      ErrorCode.RATE_LIMITED,
      'Too many password reset attempts',
    );
  }

  const body = await readValidatedBody(event, ForgotPasswordSchema.parse);

  // Always return success to prevent email enumeration
  try {
    await userService.requestPasswordReset(body.email, event);
  } catch {
    // Silently swallow — never reveal whether email exists
  }

  return { success: true };
});
