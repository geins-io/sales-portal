import * as authService from '../../services/auth';

export default defineEventHandler(async (event) => {
  const tokens = await optionalAuth(event);

  if (!tokens) {
    return { user: null };
  }

  try {
    const result = await authService.getUser(
      tokens.refreshToken,
      tokens.authToken,
      event,
    );

    if (result?.succeeded && result.user) {
      return {
        user: result.user,
        expiresAt: result.tokens?.expiresIn
          ? new Date(Date.now() + result.tokens.expiresIn * 1000).toISOString()
          : null,
      };
    }
  } catch {
    // getUser failed — session invalid
  }

  // Failed — clear cookies
  clearAuthCookies(event);

  return { user: null };
});
