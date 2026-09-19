import type { H3Event } from 'h3';
import type { GeinsUserType } from '@geins/types';
import * as userService from '../services/user';
import { ErrorCode, isErrorCode } from './errors';
import { logger } from './logger';

/**
 * Fetch the full Geins user profile for a given auth token.
 *
 * Single user-fetch path shared between `/api/auth/me` and the buyer-market
 * deep-link redirect middleware. Returns `null` on any SDK failure so
 * callers can fail-open without redirecting the user on stale tokens.
 */
export async function loadUserForToken(
  event: H3Event,
  token: string,
): Promise<GeinsUserType | null> {
  try {
    const user = await userService.getUser(token, event);
    return user ?? null;
  } catch (error) {
    if (isErrorCode(error, ErrorCode.TENANT_CONFIG_INVALID)) {
      // Not a stale/expired token — the tenant's stored Geins config is
      // broken (see mapEnvironment in server/services/_sdk.ts). Still
      // fail open below like any other SDK failure so an authenticated
      // buyer never gets redirect-looped, but log distinctly so this
      // doesn't read as routine token/lookup noise.
      logger.error(
        'Tenant config invalid while loading user for buyer-market check',
        error instanceof Error ? error : undefined,
        { hostname: event.context.tenant?.hostname },
      );
    }
    return null;
  }
}
