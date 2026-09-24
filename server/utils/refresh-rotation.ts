import type { H3Event } from 'h3';
import type { AuthResponse } from '@geins/types';
import * as authService from '../services/auth';
import { hashToken } from './request-identity';

/**
 * How long a settled rotation answers for the refresh token it consumed.
 * Geins refresh tokens are single use, and a page render sends the same stale
 * cookie on every internal hop, as parallel browser requests do.
 */
export const ROTATION_GRACE_MS = 10_000;
const MAX_ENTRIES = 5000;

interface Rotation {
  result: Promise<AuthResponse | undefined>;
  settledAt?: number;
}

const rotations = new Map<string, Rotation>();

function prune(now: number): void {
  for (const [key, entry] of rotations) {
    if (
      entry.settledAt !== undefined &&
      now - entry.settledAt >= ROTATION_GRACE_MS
    ) {
      rotations.delete(key);
    }
  }
}

function makeRoom(): void {
  while (rotations.size >= MAX_ENTRIES) {
    const oldest = rotations.keys().next().value;
    if (oldest === undefined) break;
    rotations.delete(oldest);
  }
}

/**
 * Exchanges a refresh token once, however many requests carry it: callers
 * that arrive while the call is in flight, or up to `ROTATION_GRACE_MS` after
 * it settled, get the same answer. A thrown error is not kept.
 *
 * Keyed on the hostname, not the tenant id: the tenant plugin sets the id on a
 * page request but not on its `/api/` hops. Per process only.
 */
export function rotateOnce(
  refreshToken: string,
  event: H3Event,
): Promise<AuthResponse | undefined> {
  prune(Date.now());

  const key = `${event.context.tenant?.hostname ?? ''}:${hashToken(refreshToken)}`;
  const existing = rotations.get(key);
  if (existing) return existing.result;

  const entry: Rotation = {
    result: authService.refresh(refreshToken, event).then(
      (result) => {
        entry.settledAt = Date.now();
        return result;
      },
      (error: unknown) => {
        rotations.delete(key);
        throw error;
      },
    ),
  };
  makeRoom();
  rotations.set(key, entry);
  return entry.result;
}
