import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

// ---------------------------------------------------------------------------
// Mock at the SDK boundary — let auth + organization services run for real.
// The organization service uses in-memory stubs (no SDK calls yet).
// The auth service calls sdk.crm.auth.getUser — we mock the SDK for that.
// ---------------------------------------------------------------------------
const mockCrmAuth = {
  getUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
};

vi.mock('../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue({
    core: {
      geinsSettings: { channel: '1', locale: 'sv-SE', market: 'se' },
      graphql: { query: vi.fn(), mutation: vi.fn() },
    },
    crm: {
      auth: mockCrmAuth,
      user: { get: vi.fn(), update: vi.fn(), create: vi.fn() },
    },
    cms: {},
    oms: {},
  }),
  getRequestChannelVariables: vi.fn(),
}));

// Stub Nitro auto-imports
vi.stubGlobal(
  'createAppError',
  vi.fn((code: string, message: string) => {
    const err = new Error(message);
    (err as Error & { statusCode: number }).statusCode =
      code === 'UNAUTHORIZED' ? 401 : code === 'FORBIDDEN' ? 403 : 400;
    return err;
  }),
);
vi.stubGlobal('ErrorCode', {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
});
vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());

// Stub requireAuth (Nitro auto-import from server/utils/auth.ts)
const mockRequireAuth = vi.fn();
vi.stubGlobal('requireAuth', mockRequireAuth);

const event = {} as H3Event;

// Known stub userIds from server/services/stubs/organization.ts
const STUB_USERS = {
  admin: 'user-admin-001', // role: org_admin
  approver: 'user-approver-002', // role: order_approver
  placer: 'user-placer-003', // role: order_placer
} as const;

describe('b2b-auth utilities', () => {
  let b2bAuth: typeof import('../../server/utils/b2b-auth');

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Re-stub globals after resetModules
    vi.stubGlobal('requireAuth', mockRequireAuth);
    vi.stubGlobal(
      'createAppError',
      vi.fn((code: string, message: string) => {
        const err = new Error(message);
        (err as Error & { statusCode: number }).statusCode =
          code === 'UNAUTHORIZED' ? 401 : code === 'FORBIDDEN' ? 403 : 400;
        return err;
      }),
    );
    vi.stubGlobal('ErrorCode', {
      UNAUTHORIZED: 'UNAUTHORIZED',
      FORBIDDEN: 'FORBIDDEN',
      NOT_FOUND: 'NOT_FOUND',
    });
    vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) =>
      fn(),
    );

    b2bAuth = await import('../../server/utils/b2b-auth');
  });

  // -----------------------------------------------------------------------
  // requireOrgMembership
  // -----------------------------------------------------------------------
  describe('requireOrgMembership', () => {
    it('returns tokens and buyer for a valid org member', async () => {
      const tokens = { authToken: 'auth-123', refreshToken: 'refresh-456' };
      mockRequireAuth.mockResolvedValue(tokens);
      mockCrmAuth.getUser.mockResolvedValue({
        succeeded: true,
        user: { userId: STUB_USERS.admin },
      });

      const result = await b2bAuth.requireOrgMembership(event);

      expect(result.authToken).toBe('auth-123');
      expect(result.refreshToken).toBe('refresh-456');
      expect(result.buyer.email).toBe('anna@acmecorp.se');
      expect(result.buyer.role).toBe('org_admin');
    });

    it('throws 403 when user is not a member of any org', async () => {
      mockRequireAuth.mockResolvedValue({
        authToken: 'a',
        refreshToken: 'r',
      });
      mockCrmAuth.getUser.mockResolvedValue({
        succeeded: true,
        user: { userId: 'user-lonely-no-org' },
      });

      await expect(b2bAuth.requireOrgMembership(event)).rejects.toThrow(
        'Not a member of any organization',
      );
    });

    it('throws 403 when getUser fails', async () => {
      mockRequireAuth.mockResolvedValue({
        authToken: 'a',
        refreshToken: 'r',
      });
      mockCrmAuth.getUser.mockResolvedValue({
        succeeded: false,
      });

      await expect(b2bAuth.requireOrgMembership(event)).rejects.toThrow(
        'Unable to resolve user identity',
      );
    });
  });

  // -----------------------------------------------------------------------
  // requirePermission
  // -----------------------------------------------------------------------
  describe('requirePermission', () => {
    function setupAuth(userId: string) {
      mockRequireAuth.mockResolvedValue({
        authToken: 'a',
        refreshToken: 'r',
      });
      mockCrmAuth.getUser.mockResolvedValue({
        succeeded: true,
        user: { userId },
      });
    }

    it('returns context when role has the permission', async () => {
      setupAuth(STUB_USERS.admin);

      const result = await b2bAuth.requirePermission(
        event,
        'org:manage_buyers',
      );

      expect(result.buyer.role).toBe('org_admin');
      expect(result.authToken).toBe('a');
    });

    it('throws 403 when role lacks the permission', async () => {
      setupAuth(STUB_USERS.placer);

      await expect(
        b2bAuth.requirePermission(event, 'org:manage_buyers'),
      ).rejects.toThrow('Missing permission: org:manage_buyers');
    });

    it('allows order_placer to create orders', async () => {
      setupAuth(STUB_USERS.placer);

      const result = await b2bAuth.requirePermission(event, 'orders:create');
      expect(result.buyer.role).toBe('order_placer');
    });

    it('denies order_placer from approving orders', async () => {
      setupAuth(STUB_USERS.placer);

      await expect(
        b2bAuth.requirePermission(event, 'orders:approve'),
      ).rejects.toThrow('Missing permission: orders:approve');
    });
  });
});
