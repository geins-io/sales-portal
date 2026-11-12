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

const mockRequireAuth = vi.fn();
const mockOptionalAuth = vi.fn();
vi.mock('../../server/utils/auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  optionalAuth: (...args: unknown[]) => mockOptionalAuth(...args),
}));

describe('server feature-access', () => {
  let canConfigureServer: typeof import('../../server/utils/feature-access').canConfigureServer;
  let canAccessFeatureServer: typeof import('../../server/utils/feature-access').canAccessFeatureServer;
  let assertFeatureAccess: typeof import('../../server/utils/feature-access').assertFeatureAccess;
  let sessionForFeature: typeof import('../../server/utils/feature-access').sessionForFeature;
  let assertQuoteRequestAccess: typeof import('../../server/utils/feature-access').assertQuoteRequestAccess;

  const mockEvent = {
    context: { tenant: { hostname: 'test.example.com' } },
  } as unknown as H3Event;
  const TOKENS = { authToken: 'tok', refreshToken: 'ref' };

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
    sessionForFeature = mod.sessionForFeature;
    assertQuoteRequestAccess = mod.assertQuoteRequestAccess;
    mockRequireAuth.mockReset().mockResolvedValue(TOKENS);
    mockOptionalAuth.mockReset().mockResolvedValue(null);
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
    it('lets a signed-in request configure without reading the features', async () => {
      sessionToken.mockReturnValue('a-user-token');
      expect(await canConfigureServer(mockEvent)).toBe(true);
      expect(mockFeatures).not.toHaveBeenCalled();
    });

    it('refuses a guest', async () => {
      sessionToken.mockReturnValue(undefined);
      expect(await canConfigureServer(mockEvent)).toBe(false);
    });

    it.each([
      ['{ enabled: false }', { configurator: { enabled: false } }],
      ['a bare false', { configurator: false }],
    ])(
      'lets a signed-in request through with a stored %s',
      async (_label, features) => {
        mockFeatures.mockResolvedValue(features);
        sessionToken.mockReturnValue('a-user-token');
        expect(await canConfigureServer(mockEvent)).toBe(true);
      },
    );
  });
  describe('quote requests', () => {
    const tenant = (features: Record<string, unknown>) =>
      mockFeatures.mockResolvedValue(features);
    const ON = {
      quotes: { enabled: true, access: 'authenticated' },
      quoteRequests: { enabled: true },
    };

    beforeEach(() => sessionToken.mockReturnValue('tok'));

    it('lets a signed-in buyer work on requests when quotes and quoteRequests are enabled', async () => {
      tenant(ON);

      await expect(assertQuoteRequestAccess(mockEvent)).resolves.toBe(
        undefined,
      );
    });

    it.each([
      [
        'quoteRequests is disabled',
        { ...ON, quoteRequests: { enabled: false } },
      ],
      ['quotes is disabled', { ...ON, quotes: { enabled: false } }],
      ['no quoteRequests is stored', { quotes: ON.quotes }],
      ['no quotes is stored', { quoteRequests: ON.quoteRequests }],
    ])('refuses when %s', async (_case, features) => {
      tenant(features);

      await expect(assertQuoteRequestAccess(mockEvent)).rejects.toMatchObject({
        statusCode: 403,
        message: 'Access denied: quote requests are not available',
      });
    });

    it('refuses a request with no session, whatever the switches', async () => {
      tenant({ quotes: { enabled: true }, quoteRequests: { enabled: true } });
      sessionToken.mockReturnValue(undefined);

      await expect(assertQuoteRequestAccess(mockEvent)).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });

  describe('sessionForFeature', () => {
    const unauthorized = Object.assign(new Error('Authentication required'), {
      statusCode: 401,
    });

    it('answers null for an anonymous request when the feature is open to all', async () => {
      mockFeatures.mockResolvedValue({
        orderPlacement: { enabled: true, access: 'all' },
      });
      expect(await sessionForFeature(mockEvent, 'orderPlacement')).toBeNull();
      expect(mockOptionalAuth).toHaveBeenCalledWith(mockEvent);
      expect(mockRequireAuth).not.toHaveBeenCalled();
    });

    it('answers the tokens for a signed-in request when the feature is open to all', async () => {
      mockFeatures.mockResolvedValue({
        orderPlacement: { enabled: true, access: 'all' },
      });
      mockOptionalAuth.mockResolvedValue(TOKENS);
      expect(await sessionForFeature(mockEvent, 'orderPlacement')).toEqual(
        TOKENS,
      );
      expect(mockRequireAuth).not.toHaveBeenCalled();
    });

    it.each([
      ['access authenticated', { enabled: true, access: 'authenticated' }],
      ['no access rule', { enabled: true }],
      ['disabled with access all', { enabled: false, access: 'all' }],
      ['no feature entry', undefined],
    ])(
      'requires the session when the feature has %s',
      async (_label, orderPlacement) => {
        mockFeatures.mockResolvedValue(
          orderPlacement === undefined ? {} : { orderPlacement },
        );
        mockRequireAuth.mockRejectedValue(unauthorized);
        await expect(
          sessionForFeature(mockEvent, 'orderPlacement'),
        ).rejects.toMatchObject({ statusCode: 401 });
        expect(mockRequireAuth).toHaveBeenCalledWith(mockEvent);
        expect(mockOptionalAuth).not.toHaveBeenCalled();
      },
    );

    it('passes the session through when the feature requires one', async () => {
      mockFeatures.mockResolvedValue({
        orderPlacement: { enabled: true, access: 'authenticated' },
      });
      expect(await sessionForFeature(mockEvent, 'orderPlacement')).toEqual(
        TOKENS,
      );
    });

    it('requires the session when the service has no features', async () => {
      mockFeatures.mockResolvedValue(null);
      mockRequireAuth.mockRejectedValue(unauthorized);
      await expect(
        sessionForFeature(mockEvent, 'orderPlacement'),
      ).rejects.toMatchObject({ statusCode: 401 });
    });
  });
});
