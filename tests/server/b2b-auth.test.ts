import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

import * as authService from '../../server/services/auth';
import * as organizationService from '../../server/services/organization';

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

// Stub requireAuth (Nitro auto-import from server/utils/auth.ts)
const mockRequireAuth = vi.fn();
vi.stubGlobal('requireAuth', mockRequireAuth);

// Mock the services that b2b-auth.ts imports
vi.mock('../../server/services/auth', () => ({
  getUser: vi.fn(),
}));
vi.mock('../../server/services/organization', () => ({
  getMyBuyerProfile: vi.fn(),
}));

const event = {} as H3Event;

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

    b2bAuth = await import('../../server/utils/b2b-auth');
  });

  // -----------------------------------------------------------------------
  // requireOrgMembership
  // -----------------------------------------------------------------------
  describe('requireOrgMembership', () => {
    it('returns tokens and buyer for a valid org member', async () => {
      const tokens = { authToken: 'auth-123', refreshToken: 'refresh-456' };
      mockRequireAuth.mockResolvedValue(tokens);
      vi.mocked(authService.getUser).mockResolvedValue({
        succeeded: true,
        user: { userId: 'user-1' },
      } as ReturnType<typeof authService.getUser> extends Promise<infer T>
        ? T
        : never);
      vi.mocked(organizationService.getMyBuyerProfile).mockResolvedValue({
        id: 'buyer-1',
        organizationId: 'org-1',
        userId: 'user-1',
        email: 'test@acme.se',
        firstName: 'Test',
        lastName: 'User',
        role: 'org_admin',
        status: 'active',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      });

      const result = await b2bAuth.requireOrgMembership(event);

      expect(result.authToken).toBe('auth-123');
      expect(result.refreshToken).toBe('refresh-456');
      expect(result.buyer.email).toBe('test@acme.se');
      expect(result.buyer.role).toBe('org_admin');
    });

    it('throws 403 when user is not a member of any org', async () => {
      mockRequireAuth.mockResolvedValue({
        authToken: 'a',
        refreshToken: 'r',
      });
      vi.mocked(authService.getUser).mockResolvedValue({
        succeeded: true,
        user: { userId: 'user-lonely' },
      } as ReturnType<typeof authService.getUser> extends Promise<infer T>
        ? T
        : never);
      vi.mocked(organizationService.getMyBuyerProfile).mockRejectedValue(
        new Error('No buyer profile'),
      );

      await expect(b2bAuth.requireOrgMembership(event)).rejects.toThrow(
        'Not a member of any organization',
      );
    });

    it('throws 403 when getUser fails', async () => {
      mockRequireAuth.mockResolvedValue({
        authToken: 'a',
        refreshToken: 'r',
      });
      vi.mocked(authService.getUser).mockResolvedValue({
        succeeded: false,
      } as ReturnType<typeof authService.getUser> extends Promise<infer T>
        ? T
        : never);

      await expect(b2bAuth.requireOrgMembership(event)).rejects.toThrow(
        'Unable to resolve user identity',
      );
    });
  });

  // -----------------------------------------------------------------------
  // requirePermission
  // -----------------------------------------------------------------------
  describe('requirePermission', () => {
    function setupMemberWithRole(
      role: 'org_admin' | 'order_approver' | 'order_placer',
    ) {
      mockRequireAuth.mockResolvedValue({
        authToken: 'a',
        refreshToken: 'r',
      });
      vi.mocked(authService.getUser).mockResolvedValue({
        succeeded: true,
        user: { userId: 'u1' },
      } as ReturnType<typeof authService.getUser> extends Promise<infer T>
        ? T
        : never);
      vi.mocked(organizationService.getMyBuyerProfile).mockResolvedValue({
        id: 'b1',
        organizationId: 'o1',
        userId: 'u1',
        email: 'test@acme.se',
        firstName: 'T',
        lastName: 'U',
        role,
        status: 'active',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      });
    }

    it('returns context when role has the permission', async () => {
      setupMemberWithRole('org_admin');

      const result = await b2bAuth.requirePermission(
        event,
        'org:manage_buyers',
      );

      expect(result.buyer.role).toBe('org_admin');
      expect(result.authToken).toBe('a');
    });

    it('throws 403 when role lacks the permission', async () => {
      setupMemberWithRole('order_placer');

      await expect(
        b2bAuth.requirePermission(event, 'org:manage_buyers'),
      ).rejects.toThrow('Missing permission: org:manage_buyers');
    });

    it('allows order_placer to create orders', async () => {
      setupMemberWithRole('order_placer');

      const result = await b2bAuth.requirePermission(event, 'orders:create');
      expect(result.buyer.role).toBe('order_placer');
    });

    it('denies order_placer from approving orders', async () => {
      setupMemberWithRole('order_placer');

      await expect(
        b2bAuth.requirePermission(event, 'orders:approve'),
      ).rejects.toThrow('Missing permission: orders:approve');
    });
  });
});
