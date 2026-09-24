import type { H3Event } from 'h3';
import type { AuthResponse } from '@geins/types';
import { getAuthCookies } from './cookies';

export interface AuthTokens {
  authToken: string;
  refreshToken: string;
}

/**
 * The session as decided once per request by `resolveSession`
 * (`server/utils/auth.ts`). Absent on `event.context` means nothing decided it:
 * a path the session middleware skips, or a refresh that failed inside our own
 * layer.
 */
export type SessionState =
  | { status: 'anonymous' }
  | { status: 'expired' }
  | {
      status: 'active';
      tokens: AuthTokens;
      /** The refresh answer, when this request rotated the pair. */
      rotation?: AuthResponse;
    };

/**
 * The user token this request speaks to the Merchant API with. Every consumer
 * reads it here rather than from the cookie: after a rotation the request
 * cookie still holds the old value, or none.
 */
export function getSessionToken(event: H3Event): string | undefined {
  const session = event.context?.session;
  if (!session) return getAuthCookies(event).authToken;
  return session.status === 'active' ? session.tokens.authToken : undefined;
}
