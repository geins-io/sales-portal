import * as authService from '../../services/auth';
import { resolveBuyerMarket } from '../../utils/buyer-market-resolver';
import { ErrorCode, isErrorCode } from '../../utils/errors';
import { logger } from '../../utils/logger';

const NAME_CLAIM = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name';

export default defineEventHandler(async (event) => {
  // Preview mode or impersonation: decode JWT directly — no CRM call.
  // These tokens have no refresh token, so optionalAuth would fall through
  // to getUser() which fails → clearAuthCookies → redirect loop.
  const isPreview = getPreviewCookie(event);
  const spoofedByCookie = getSpoofedByCookie(event);

  if (isPreview || spoofedByCookie) {
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
    const spoofedBy =
      spoofedByCookie || (payload.SpoofedBy as string | undefined);

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
      // Re-affirm the market on session restore: pick the market matching the
      // buyer's company delivery country so a stale cookie (set on a previous
      // session, after a tenant config change, or after the company moved
      // pricelists) self-heals. crm.auth.getUser returns the JWT-decoded shape
      // without availableChannels, so the resolver fetches the market data
      // itself from the token.
      const resolvedMarket = await resolveBuyerMarket(
        event,
        tokens.authToken,
      ).catch(() => null);
      return {
        user: result.user,
        expiresAt: result.tokens?.expiresIn
          ? new Date(Date.now() + result.tokens.expiresIn * 1000).toISOString()
          : null,
        market: resolvedMarket,
      };
    }
  } catch (error) {
    if (isErrorCode(error, ErrorCode.TENANT_CONFIG_INVALID)) {
      // Not an expired session — the tenant's stored Geins config is
      // broken (see mapEnvironment in server/services/_sdk.ts). We still
      // fail safe and end the session below, same as any other getUser
      // failure, but log this distinctly so it doesn't read as routine
      // session expiry.
      logger.error(
        'Tenant config invalid while fetching session user',
        error instanceof Error ? error : undefined,
        { hostname: event.context.tenant?.hostname },
      );
    }
    // getUser failed — session invalid (or tenant config broken; either
    // way the session ends below)
  }

  // Failed — clear cookies
  clearAuthCookies(event);

  return { user: null };
});
