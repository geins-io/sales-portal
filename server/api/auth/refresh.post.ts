import * as authService from '../../services/auth';

export default defineEventHandler(async (event) => {
  const refreshToken = getCookie(event, 'refresh_token');

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
    deleteCookie(event, 'auth_token', { path: '/' });
    deleteCookie(event, 'refresh_token', { path: '/' });
    throw createAppError(ErrorCode.UNAUTHORIZED, 'Token refresh failed');
  }

  const { tokens, user } = result;

  // Rotate cookies with new tokens
  setCookie(event, 'auth_token', tokens.token!, {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: 'lax',
    path: '/',
    maxAge: tokens.expiresIn ?? 3600,
  });

  setCookie(event, 'refresh_token', tokens.refreshToken!, {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  return {
    user,
    expiresAt: tokens.expiresIn
      ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString()
      : null,
  };
});
