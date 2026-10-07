import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

// Mock the tenant-config service
const mockFeatures = vi.fn();

vi.mock('../../server/services/tenant-config', () => ({
  getFeatures: (...args: unknown[]) => mockFeatures(...args),
}));

// Mock h3 createError (auto-imported in Nitro)
vi.mock('h3', async () => {
  const actual = await vi.importActual<typeof import('h3')>('h3');
  return {
    ...actual,
    createError: (opts: { statusCode: number; message: string }) => {
      const err = new Error(opts.message) as Error & { statusCode: number };
      err.statusCode = opts.statusCode;
      return err;
    },
  };
});

const sessionToken = vi.fn<() => string | undefined>();
vi.stubGlobal('getSessionToken', () => sessionToken());

describe('server feature-access', () => {
  let canConfigureServer: typeof import('../../server/utils/feature-access').canConfigureServer;
  let canAccessFeatureServer: typeof import('../../server/utils/feature-access').canAccessFeatureServer;
  let assertFeatureAccess: typeof import('../../server/utils/feature-access').assertFeatureAccess;

  const mockEvent = {
    context: { tenant: { hostname: 'test.example.com' } },
  } as unknown as H3Event;

  beforeEach(async () => {
    mockFeatures.mockReset();
    mockFeatures.mockResolvedValue({
      search: { enabled: true },
      cart: { enabled: true, access: 'authenticated' },
      disabled: { enabled: false },
    });

    vi.resetModules();
    const mod = await import('../../server/utils/feature-access');
    canAccessFeatureServer = mod.canAccessFeatureServer;
    canConfigureServer = mod.canConfigureServer;
    sessionToken.mockReset().mockReturnValue(undefined);
    assertFeatureAccess = mod.assertFeatureAccess;
  });

  describe('canAccessFeatureServer', () => {
    it('grants access to enabled feature with no access rule', async () => {
      expect(await canAccessFeatureServer(mockEvent, 'search')).toBe(true);
    });

    it('defaults to anonymous user when no user provided', async () => {
      expect(await canAccessFeatureServer(mockEvent, 'cart')).toBe(false);
    });

    it('grants access when user context matches', async () => {
      expect(
        await canAccessFeatureServer(mockEvent, 'cart', {
          authenticated: true,
        }),
      ).toBe(true);
    });

    it('denies access to disabled feature', async () => {
      expect(
        await canAccessFeatureServer(mockEvent, 'disabled', {
          authenticated: true,
        }),
      ).toBe(false);
    });

    it('denies access to nonexistent feature', async () => {
      expect(await canAccessFeatureServer(mockEvent, 'nonexistent')).toBe(
        false,
      );
    });

    it('handles null features from service', async () => {
      mockFeatures.mockResolvedValue(null);
      expect(await canAccessFeatureServer(mockEvent, 'search')).toBe(false);
    });
  });

  describe('assertFeatureAccess', () => {
    it('does not throw when feature is accessible', async () => {
      await expect(
        assertFeatureAccess(mockEvent, 'search'),
      ).resolves.toBeUndefined();
    });

    it('throws 403 when feature is not accessible', async () => {
      await expect(
        assertFeatureAccess(mockEvent, 'cart'),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('cart'),
      });
    });

    it('throws 403 for disabled feature', async () => {
      await expect(
        assertFeatureAccess(mockEvent, 'disabled', { authenticated: true }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('passes with correct user context', async () => {
      await expect(
        assertFeatureAccess(mockEvent, 'cart', { authenticated: true }),
      ).resolves.toBeUndefined();
    });
  });

  describe('canConfigureServer', () => {
    it('lets a signed-in request configure when the configurator is on', async () => {
      mockFeatures.mockResolvedValue({ configurator: { enabled: true } });
      sessionToken.mockReturnValue('a-user-token');
      expect(await canConfigureServer(mockEvent)).toBe(true);
      expect(mockFeatures).toHaveBeenCalledWith(mockEvent);
    });

    it("refuses a guest, even with the configurator's access rule open to all", async () => {
      mockFeatures.mockResolvedValue({
        configurator: { enabled: true, access: 'all' },
      });
      expect(await canConfigureServer(mockEvent)).toBe(false);
    });

    it('refuses a signed-in request when the configurator is off or absent', async () => {
      sessionToken.mockReturnValue('a-user-token');
      mockFeatures.mockResolvedValue({ configurator: { enabled: false } });
      expect(await canConfigureServer(mockEvent)).toBe(false);
      mockFeatures.mockResolvedValue(null);
      expect(await canConfigureServer(mockEvent)).toBe(false);
    });
  });
});
