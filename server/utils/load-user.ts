import type { H3Event } from 'h3';
import type { GeinsUserType } from '@geins/types';
import * as userService from '../services/user';

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
  } catch {
    return null;
  }
}
