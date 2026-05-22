import type { GeinsUserType } from '@geins/types';
import * as authService from '../../services/auth';
import { resolveBuyerMarket } from '../../utils/buyer-market';
import { loadUserForToken } from '../../utils/load-user';

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
      // Self-heal the market cookie if a stale value points at a market the
      // buyer is no longer allowed on (cookie set on a previous session,
      // tenant config change, buyer's company moved pricelists, etc). The
      // result.user from crm.auth.getUser is the JWT-decoded shape without
      // availableChannels, so we need the full profile here. Reuse the
      // copy stashed by buyer-market middleware on this same request when
      // available, otherwise fall back to a direct fetch.
      const stashed = (event.context as { user?: GeinsUserType } | undefined)
        ?.user;
      const fullUser =
        stashed ?? (await loadUserForToken(event, tokens.authToken));
      const resolvedMarket = resolveBuyerMarket(event, fullUser);
      return {
        user: result.user,
        expiresAt: result.tokens?.expiresIn
          ? new Date(Date.now() + result.tokens.expiresIn * 1000).toISOString()
          : null,
        market: resolvedMarket,
      };
    }
  } catch {
    // getUser failed — session invalid
  }

  // Failed — clear cookies
  clearAuthCookies(event);

  return { user: null };
});
