import type { SessionState } from './evaluate';
import type { Seed } from './seed/types';

// ---------------------------------------------------------------------------
// The sessions the fixture holds.
//
// In server memory, so a deploy drops every session — which is also true of the
// CPQ mock and is why the UI must survive a 410 at any point. Keyed by tenant
// as well as by id: a configuration belongs to the storefront that started it,
// and an id leaking between tenants would be a bug worth catching here rather
// than in production.
//
// A released or committed session is kept as departed rather than deleted. The
// difference matters to the UI: 410 means "this was yours and is gone", 404
// means "this was never yours". After the retention window even the provider
// has forgotten, so the id falls back to 404 by time rather than by code.
// ---------------------------------------------------------------------------

export interface StoredSession {
  seed: Seed;
  state: SessionState;
  expiresAt: number;
  departedAt?: number;
}

export interface SessionStore {
  put(hostname: string, id: string, session: StoredSession): void;
  /** The live session, or the 404/410 the caller should answer with. */
  require(hostname: string, id: string): StoredSession;
  /** Whether `require` would answer anything but 404 for this id. */
  has(hostname: string, id: string): boolean;
}

export function createSessionStore(
  now: () => number,
  retentionMs: number,
): SessionStore {
  const sessions = new Map<string, StoredSession>();
  const key = (hostname: string, id: string) => `${hostname}|${id}`;
  const forgotten = (session: StoredSession) =>
    session.departedAt !== undefined &&
    now() >= session.departedAt + retentionMs;

  return {
    put(hostname, id, session) {
      sessions.set(key(hostname, id), session);
    },
    require(hostname, id) {
      const at = key(hostname, id);
      const session = sessions.get(at);
      if (!session) {
        throw createAppError(ErrorCode.NOT_FOUND, 'No such configuration');
      }
      if (forgotten(session)) {
        sessions.delete(at);
        throw createAppError(ErrorCode.NOT_FOUND, 'No such configuration');
      }
      if (session.departedAt !== undefined) {
        throw createAppError(ErrorCode.GONE, 'The configuration is finished');
      }
      if (now() >= session.expiresAt) {
        throw createAppError(ErrorCode.GONE, 'The configuration has expired');
      }
      return session;
    },
    has(hostname, id) {
      const session = sessions.get(key(hostname, id));
      return session !== undefined && !forgotten(session);
    },
  };
}
