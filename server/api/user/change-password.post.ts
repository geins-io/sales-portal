import * as userService from '../../services/user';
import { requireAuth } from '../../utils/auth';
import { ChangePasswordSchema } from '../../schemas/api-input';
import {
  changePasswordRateLimiter,
  getClientIp,
} from '../../utils/rate-limiter';

export default defineEventHandler(async (event) => {
  const clientIp = getClientIp(event);
  const rateLimit = await changePasswordRateLimiter.check(clientIp);

  if (!rateLimit.allowed) {
    throw createAppError(
      ErrorCode.RATE_LIMITED,
      'Too many password change attempts',
    );
  }

  const { refreshToken } = await requireAuth(event);
  const body = await readValidatedBody(event, ChangePasswordSchema.parse);

  const result = await userService.changePassword(
    {
      username: '',
      password: body.currentPassword,
      newPassword: body.newPassword,
    },
    refreshToken,
    event,
  );

  if (!result) {
    throw createAppError(ErrorCode.BAD_REQUEST, 'Password change failed');
  }

  return { success: true };
});
