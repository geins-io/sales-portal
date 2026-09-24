import { createHash } from 'node:crypto';
import type { H3Event } from 'h3';
import { getSessionToken } from './session';

/** Cache-key segment for a request that sends no user token. */
export const ANONYMOUS_IDENTITY = 'anon';

/**
 * Short, stable fingerprint of a bearer token. 16 hex chars is wide enough that
 * two live tokens will not collide and narrow enough to keep a cache key or a
 * log line readable.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 16);
}

/**
 * Whether the Merchant API will be queried as a signed-in caller.
 * `buildRequestContext` reads the same session token, so this answers exactly
 * "is a user token sent".
 */
export function hasUserToken(event: H3Event): boolean {
  return Boolean(getSessionToken(event));
}

/**
 * Identity segment for a per-caller cache key: the token hash when a token is
 * sent, a fixed marker otherwise so anonymous traffic keeps sharing one entry.
 *
 * Hashes the token the SDK is given rather than a claim decoded from it, so the
 * key separates callers on every dimension the API filters by — account,
 * customer group, or anything added later.
 */
export function getRequestIdentity(event: H3Event): string {
  const authToken = getSessionToken(event);
  return authToken ? hashToken(authToken) : ANONYMOUS_IDENTITY;
}
