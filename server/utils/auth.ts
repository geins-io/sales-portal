import type { H3Event } from 'h3';
import type { AuthResponse } from '@geins/types';
import { GeinsCustomerType } from '@geins/types';
import { logger } from './logger';
import { rotateOnce } from './refresh-rotation';
import type { AuthTokens, SessionState } from './session';

/**
 * `@geins/crm` renews the refresh token inside `getUser` when the auth token
 * has less than this left, and its caller never sees the new pair. The SDK
 * does not export the value; `tests/server/utils/sdk-expires-soon.test.ts`
 * pins it to the installed version.
 */
export const EXPIRES_SOON_SECONDS = 90;

/** Whole seconds left on a token, as the SDK counts them; NaN when unreadable. */
function secondsLeft(token: string): number {
  return Number(decodeJwtPayload(token)?.exp) - Math.floor(Date.now() / 1000);
}

export function isExpiringSoon(token: string): boolean {
  return secondsLeft(token) < EXPIRES_SOON_SECONDS;
}

function isRotated(result: AuthResponse | undefined): result is AuthResponse & {
  tokens: { token: string; refreshToken: string };
} {
  return Boolean(
    result?.succeeded && result.tokens?.token && result.tokens.refreshToken,
  );
}

async function decideSession(
  event: H3Event,
): Promise<SessionState | undefined> {
  const { authToken, refreshToken } = getAuthCookies(event);

  // Preview and impersonation tokens come without a refresh token.
  if (authToken && !refreshToken) {
    return { status: 'active', tokens: { authToken, refreshToken: '' } };
  }
  if (authToken && refreshToken && !isExpiringSoon(authToken)) {
    return { status: 'active', tokens: { authToken, refreshToken } };
  }
  if (!refreshToken) return { status: 'anonymous' };

  let rotation: AuthResponse | undefined;
  try {
    rotation = await rotateOnce(refreshToken, event);
  } catch (error) {
    // @geins/crm answers every refresh failure, a Geins outage included, with
    // { succeeded: false }; a throw comes from our own layer and says nothing
    // about the session.
    logger.warn('Session not decided: refresh threw', {
      hostname: event.context.tenant?.hostname,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }

  if (!isRotated(rotation)) {
    // A refused early renewal leaves a token that still works: a Geins hiccup
    // or a dropped response must not sign the buyer out. The request after it
    // runs out decides.
    if (authToken && secondsLeft(authToken) > 0) {
      return { status: 'active', tokens: { authToken, refreshToken } };
    }
    clearAuthCookies(event);
    return { status: 'expired' };
  }

  setAuthCookies(event, {
    token: rotation.tokens.token,
    refreshToken: rotation.tokens.refreshToken,
    expiresIn: rotation.tokens.expiresIn,
  });
  return {
    status: 'active',
    tokens: {
      authToken: rotation.tokens.token,
      refreshToken: rotation.tokens.refreshToken,
    },
    rotation,
  };
}

/**
 * Decides the session once per request and leaves it on `event.context`.
 * Rotates when the auth cookie is gone or about to expire; never throws.
 * `undefined` means not decided, and the request cookie stays the source.
 */
export async function resolveSession(
  event: H3Event,
): Promise<SessionState | undefined> {
  if (event.context.session) return event.context.session;
  const session = await decideSession(event);
  if (session) event.context.session = session;
  return session;
}

function tokensOf(
  event: H3Event,
  session: SessionState | undefined,
): AuthTokens | null {
  if (session) return session.status === 'active' ? session.tokens : null;
  const { authToken, refreshToken } = getAuthCookies(event);
  return authToken ? { authToken, refreshToken: refreshToken ?? '' } : null;
}

/**
 * The session tokens for an authenticated API route:
 * ```ts
 * const { authToken, refreshToken } = await requireAuth(event);
 * ```
 *
 * @throws 401 SESSION_EXPIRED when Geins refused the refresh — the only code
 *   the client redirects to login on; 401 UNAUTHORIZED otherwise
 */
export async function requireAuth(event: H3Event): Promise<AuthTokens> {
  const session = await resolveSession(event);
  if (session?.status === 'expired') {
    throw createAppError(ErrorCode.SESSION_EXPIRED, 'Session expired');
  }
  const tokens = tokensOf(event, session);
  if (!tokens) {
    throw createAppError(ErrorCode.UNAUTHORIZED, 'Authentication required');
  }
  return tokens;
}

/**
 * Like requireAuth but returns null instead of throwing when not authenticated.
 * Useful for routes that work for both authenticated and anonymous users.
 */
export async function optionalAuth(event: H3Event): Promise<AuthTokens | null> {
  return tokensOf(event, await resolveSession(event));
}

/**
 * Extracts the customer type from the current user's JWT payload.
 * Returns undefined for anonymous users, invalid tokens, or preview mode.
 *
 * The claim is `CustomerType`, PascalCase, and its value is a numeric enum:
 * 1 is a private person, 2 an organisation, and 0 means unset.
 */
export async function getCustomerType(
  event: H3Event,
): Promise<GeinsCustomerType | undefined> {
  if (getPreviewCookie(event)) {
    return undefined;
  }

  const auth = await optionalAuth(event);
  if (!auth) {
    return undefined;
  }

  try {
    const payload = decodeJwtPayload(auth.authToken);
    if (payload?.CustomerType === undefined || payload.CustomerType === null) {
      return undefined;
    }

    switch (String(payload.CustomerType).trim()) {
      case '1':
        return GeinsCustomerType.PersonType;
      case '2':
        return GeinsCustomerType.OrganizationType;
      default:
        return undefined;
    }
  } catch {
    return undefined;
  }
}

export function decodeJwtPayload(
  token: string,
): Record<string, unknown> | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}
