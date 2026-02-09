import type { H3Event } from 'h3';
import * as authService from '../services/auth';

export interface AuthTokens {
  authToken: string;
  refreshToken: string;
}

/**
 * Reads auth cookies and ensures tokens are valid.
 * If the auth token is missing but a refresh token exists, performs a
 * transparent refresh and rotates both cookies.
 *
 * Call this at the top of any authenticated API route:
 * ```ts
 * const { authToken, refreshToken } = await requireAuth(event);
 * ```
 *
 * @throws 401 if no valid session exists
 */
export async function requireAuth(event: H3Event): Promise<AuthTokens> {
  const authToken = getCookie(event, 'auth_token');
  const refreshToken = getCookie(event, 'refresh_token');

  // Have both tokens — return them (SDK will reject if auth token is truly expired)
  if (authToken && refreshToken) {
    return { authToken, refreshToken };
  }

  // No auth token but have refresh token — try to refresh
  if (!authToken && refreshToken) {
    return await refreshAndRotate(event, refreshToken);
  }

  // No tokens at all
  clearAuthCookies(event);
  throw createAppError(ErrorCode.UNAUTHORIZED, 'Authentication required');
}

/**
 * Like requireAuth but returns null instead of throwing when not authenticated.
 * Useful for routes that work for both authenticated and anonymous users.
 */
export async function optionalAuth(event: H3Event): Promise<AuthTokens | null> {
  const authToken = getCookie(event, 'auth_token');
  const refreshToken = getCookie(event, 'refresh_token');

  if (authToken && refreshToken) {
    return { authToken, refreshToken };
  }

  if (!authToken && refreshToken) {
    try {
      return await refreshAndRotate(event, refreshToken);
    } catch {
      clearAuthCookies(event);
      return null;
    }
  }

  return null;
}

async function refreshAndRotate(
  event: H3Event,
  refreshToken: string,
): Promise<AuthTokens> {
  try {
    const result = await authService.refresh(refreshToken, event);

    if (
      !result?.succeeded ||
      !result.tokens?.token ||
      !result.tokens?.refreshToken
    ) {
      clearAuthCookies(event);
      throw createAppError(ErrorCode.UNAUTHORIZED, 'Session expired');
    }

    const { tokens } = result;

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
      maxAge: 30 * 24 * 60 * 60,
    });

    return {
      authToken: tokens.token!,
      refreshToken: tokens.refreshToken!,
    };
  } catch (error) {
    clearAuthCookies(event);
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error; // Re-throw H3 errors
    }
    throw createAppError(ErrorCode.UNAUTHORIZED, 'Session expired');
  }
}

function clearAuthCookies(event: H3Event) {
  deleteCookie(event, 'auth_token', { path: '/' });
  deleteCookie(event, 'refresh_token', { path: '/' });
}
