import * as authService from '../../services/auth';

export default defineEventHandler(async (event) => {
  const body = await readBody<{ username: string; password: string }>(event);

  if (!body?.username || !body?.password) {
    throw createAppError(
      ErrorCode.VALIDATION_ERROR,
      'Username and password are required',
    );
  }

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
