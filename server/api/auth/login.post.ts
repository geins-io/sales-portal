import * as authService from '../../services/auth';
import { loginRateLimiter, getClientIp } from '../../utils/rate-limiter';
import { LoginSchema } from '../../schemas/api-input';

export default defineEventHandler(async (event) => {
  const clientIp = getClientIp(event);
  const rateLimit = await loginRateLimiter.check(clientIp);

  if (!rateLimit.allowed) {
    throw createAppError(ErrorCode.RATE_LIMITED, 'Too many login attempts');
  }

  const body = await readValidatedBody(event, LoginSchema.parse);

  const result = await authService.login(
    { username: body.username, password: body.password },
    event,
  );

  if (
    !result?.succeeded ||
    !result.tokens?.token ||
    !result.tokens?.refreshToken
  ) {
    throw createAppError(ErrorCode.UNAUTHORIZED, 'Invalid credentials');
  }

  const { tokens, user } = result;

  // Set httpOnly cookies — tokens never reach the client
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
