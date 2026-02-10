import * as userService from '../../services/user';

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    username: string;
    password: string;
    user?: Record<string, unknown>;
  }>(event);

  if (!body?.username || !body?.password) {
    throw createAppError(
      ErrorCode.VALIDATION_ERROR,
      'Username and password are required',
    );
  }

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
