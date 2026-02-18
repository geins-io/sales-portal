import * as userService from '../../services/user';
import { registerRateLimiter, getClientIp } from '../../utils/rate-limiter';
import { RegisterSchema } from '../../schemas/api-input';

export default defineEventHandler(async (event) => {
  const clientIp = getClientIp(event);
  const rateLimit = await registerRateLimiter.check(clientIp);

  if (!rateLimit.allowed) {
    throw createAppError(
      ErrorCode.RATE_LIMITED,
      'Too many registration attempts',
    );
  }

  const body = await readValidatedBody(event, RegisterSchema.parse);

  const result = await userService.register(
    { username: body.username, password: body.password },
    body.user,
    event,
  );

  if (
    !result?.succeeded ||
    !result.tokens?.token ||
    !result.tokens?.refreshToken
  ) {
    throw createAppError(ErrorCode.BAD_REQUEST, 'Registration failed');
  }

  const { tokens, user } = result;

  setAuthCookies(event, {
    token: tokens.token!,
    refreshToken: tokens.refreshToken!,
    expiresIn: tokens.expiresIn,
  });

  return {
    user,
    expiresAt: tokens.expiresIn
      ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString()
      : null,
  };
});
