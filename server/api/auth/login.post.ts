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
