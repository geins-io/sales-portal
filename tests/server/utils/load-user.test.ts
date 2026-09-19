import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

import { loadUserForToken } from '../../../server/utils/load-user';

// load-user.ts is imported statically above, and ES module imports execute
// before this file's own top-level `const`s — so the hoisted vi.mock
// factories below need vi.hoisted() to have their referenced mocks ready in
// time (a plain `const mockX = vi.fn()` here would still be in its
// temporal-dead-zone when the factory runs).
const { mockGetUser, mockLoggerError } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock('../../../server/services/user', () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

vi.mock('../../../server/utils/logger', () => ({
  logger: {
    error: mockLoggerError,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

function makeEvent(hostname = 'broken-tenant.example.com'): H3Event {
  return {
    context: { tenant: { hostname } },
  } as unknown as H3Event;
}

/** A caught error shaped like the H3Error mapEnvironment() throws for a bad tenant environment. */
function tenantConfigInvalidError(): Error & {
  statusCode: number;
  data: { code: string };
} {
  const err = new Error(
    'Unknown Geins environment: "dev". Expected "production" or "staging".',
  ) as Error & { statusCode: number; data: { code: string } };
  err.statusCode = 500;
  err.data = { code: 'TENANT_CONFIG_INVALID' };
  return err;
}

describe('server/utils/load-user', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the user on success', async () => {
    mockGetUser.mockResolvedValue({ id: 1, email: 'buyer@example.com' });

    const result = await loadUserForToken(makeEvent(), 'tok');

    expect(result).toEqual({ id: 1, email: 'buyer@example.com' });
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it('returns null when the SDK resolves with no user, without logging', async () => {
    mockGetUser.mockResolvedValue(undefined);

    const result = await loadUserForToken(makeEvent(), 'tok');

    expect(result).toBeNull();
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it('fails open (returns null) without extra logging on an ordinary SDK failure', async () => {
    mockGetUser.mockRejectedValue(new Error('stale token'));

    const result = await loadUserForToken(makeEvent(), 'tok');

    expect(result).toBeNull();
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it('still fails open but logs distinctly when the SDK fails with a broken tenant config', async () => {
    const error = tenantConfigInvalidError();
    mockGetUser.mockRejectedValue(error);

    const result = await loadUserForToken(
      makeEvent('broken-tenant.example.com'),
      'tok',
    );

    // Same fail-open outcome as any other SDK failure — never throws, never
    // redirects the caller (server/middleware/01.buyer-market.ts relies on
    // this to stay a no-op on lookup failure).
    expect(result).toBeNull();
    // But logged distinctly, unlike the ordinary-failure case above.
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.stringContaining('Tenant config invalid'),
      error,
      expect.objectContaining({ hostname: 'broken-tenant.example.com' }),
    );
  });
});
