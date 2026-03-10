import type { H3Event } from 'h3';
import { GeinsCustomerType } from '@geins/types';
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
  const { authToken, refreshToken } = getAuthCookies(event);

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
  const { authToken, refreshToken } = getAuthCookies(event);

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

/**
 * Extracts the customer type from the current user's JWT payload.
 * Returns undefined for anonymous users, invalid tokens, or preview mode.
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
    if (!payload?.customerType) {
      return undefined;
    }

    const normalized = String(payload.customerType).toUpperCase();
    if (normalized === GeinsCustomerType.OrganizationType) {
      return GeinsCustomerType.OrganizationType;
    }
    if (normalized === GeinsCustomerType.PersonType) {
      return GeinsCustomerType.PersonType;
    }

    return undefined;
  } catch {
    return undefined;
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
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

    setAuthCookies(event, {
      token: tokens.token!,
      refreshToken: tokens.refreshToken!,
      expiresIn: tokens.expiresIn,
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
