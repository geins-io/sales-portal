import * as userService from '../../services/user';
import { ResetPasswordSchema } from '../../schemas/api-input';

export default defineEventHandler(async (event) => {
  const ip = getClientIp(event);
  const { allowed } = await resetPasswordRateLimiter.check(ip);
  if (!allowed) {
    throw createAppError(ErrorCode.RATE_LIMITED, 'Too many attempts');
  }

  const body = await readValidatedBody(event, ResetPasswordSchema.parse);

  const result = await userService.commitPasswordReset(
    body.resetKey,
    body.password,
    event,
  );

  if (!result) {
    throw createAppError(ErrorCode.BAD_REQUEST, 'Password reset failed');
  }

  return { success: true };
});
