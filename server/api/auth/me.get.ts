import * as authService from '../../services/auth';

const NAME_CLAIM = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name';

export default defineEventHandler(async (event) => {
  // Preview mode: decode JWT directly — no CRM call (preview tokens have
  // no refresh token, so optionalAuth would return null → redirect loop).
  if (getPreviewCookie(event)) {
    const { authToken } = getAuthCookies(event);
    if (!authToken) {
      return { user: null };
    }

    const payload = decodeJwtPayload(authToken);
    if (!payload) {
      return { user: null };
    }

    const username = payload[NAME_CLAIM] as string | undefined;
    const customerType = payload.CustomerType as string | undefined;
    const memberId = payload.MemberId as string | undefined;
    const spoofedBy = payload.SpoofedBy as string | undefined;

    return {
      user: { username, customerType, memberId },
      spoofedBy,
    };
  }

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
