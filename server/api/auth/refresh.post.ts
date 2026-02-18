import * as authService from '../../services/auth';
import { refreshRateLimiter, getClientIp } from '../../utils/rate-limiter';

export default defineEventHandler(async (event) => {
  const clientIp = getClientIp(event);
  const rateLimit = await refreshRateLimiter.check(clientIp);

  if (!rateLimit.allowed) {
    throw createAppError(ErrorCode.RATE_LIMITED, 'Too many refresh attempts');
  }

  const { refreshToken } = getAuthCookies(event);

  if (!refreshToken) {
    throw createAppError(ErrorCode.UNAUTHORIZED, 'No refresh token');
  }

  const result = await authService.refresh(refreshToken, event);

  if (
    !result?.succeeded ||
    !result.tokens?.token ||
    !result.tokens?.refreshToken
  ) {
    // Refresh failed — clear stale cookies
    clearAuthCookies(event);
    throw createAppError(ErrorCode.UNAUTHORIZED, 'Token refresh failed');
  }

  const { tokens, user } = result;

  // Rotate cookies with new tokens
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
