import { describe, it, expect, vi, beforeEach } from 'vitest';

type AnyFn = (...args: unknown[]) => unknown;

// ---------------------------------------------------------------------------
// Mock at the SDK boundary — let cms service run for real
// ---------------------------------------------------------------------------
const mockMenuGet = vi.fn();

const mockSDK = {
  core: {
    geinsSettings: { channel: '1', locale: 'sv-SE', market: 'se' },
  },
  cms: {
    menu: { get: mockMenuGet },
  },
};

vi.mock('../../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue(mockSDK),
  getChannelVariables: vi.fn(),
  getRequestChannelVariables: vi
    .fn()
    .mockReturnValue({ channelId: '1', languageId: 'sv-SE', marketId: 'se' }),
  buildRequestContext: vi.fn().mockReturnValue(undefined),
}));

vi.stubGlobal('defineEventHandler', (fn: AnyFn) => fn);
vi.stubGlobal('getValidatedQuery', vi.fn());
vi.stubGlobal('withErrorHandling', async (fn: () => Promise<unknown>) => fn());
vi.stubGlobal(
  'createAppError',
  vi.fn((code: string, msg: string) => new Error(`${code}: ${msg}`)),
);
vi.stubGlobal('ErrorCode', {
  BAD_REQUEST: 'BAD_REQUEST',
});
vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());
vi.stubGlobal('getRequestLocale', vi.fn().mockReturnValue(undefined));
vi.stubGlobal('getRequestMarket', vi.fn().mockReturnValue(undefined));
vi.stubGlobal('setHeader', vi.fn());
vi.stubGlobal('getPreviewCookie', vi.fn().mockReturnValue(false));

describe('GET /api/cms/menu', () => {
  const mockEvent = {
    context: { tenant: { hostname: 'test.com' } },
  } as unknown as import('h3').H3Event;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    // Re-stub globals after resetModules
    vi.stubGlobal('defineEventHandler', (fn: AnyFn) => fn);
    vi.stubGlobal('getValidatedQuery', vi.fn());
    vi.stubGlobal('withErrorHandling', async (fn: () => Promise<unknown>) =>
      fn(),
    );
    vi.stubGlobal(
      'createAppError',
      vi.fn((code: string, msg: string) => new Error(`${code}: ${msg}`)),
    );
    vi.stubGlobal('ErrorCode', { BAD_REQUEST: 'BAD_REQUEST' });
    vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) =>
      fn(),
    );
    vi.stubGlobal('getRequestLocale', vi.fn().mockReturnValue(undefined));
    vi.stubGlobal('getRequestMarket', vi.fn().mockReturnValue(undefined));
    vi.stubGlobal('setHeader', vi.fn());
    vi.stubGlobal('getPreviewCookie', vi.fn().mockReturnValue(false));

    (
      globalThis.getValidatedQuery as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      menuLocationId: 'main-menu',
    });
  });

  it('returns menu data from SDK', async () => {
    const mockMenuData = {
      id: 'main-menu',
      items: [{ title: 'Home', url: '/' }],
    };
    mockMenuGet.mockResolvedValue(mockMenuData);

    const handler = (await import('../../../../server/api/cms/menu.get'))
      .default;
    const result = await handler(mockEvent);

    expect(mockMenuGet).toHaveBeenCalledWith(
      {
        menuLocationId: 'main-menu',
        channelId: '1',
        languageId: 'sv-SE',
        marketId: 'se',
      },
      undefined,
    );
    expect(result).toEqual(mockMenuData);
  });

  it('calls SDK with parsed menuLocationId', async () => {
    (
      globalThis.getValidatedQuery as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      menuLocationId: 'footer-menu',
    });
    mockMenuGet.mockResolvedValue({ id: 'footer-menu', items: [] });

    const handler = (await import('../../../../server/api/cms/menu.get'))
      .default;
    await handler(mockEvent);

    expect(mockMenuGet).toHaveBeenCalledWith(
      {
        menuLocationId: 'footer-menu',
        channelId: '1',
        languageId: 'sv-SE',
        marketId: 'se',
      },
      undefined,
    );
  });

  it('throws when SDK rejects', async () => {
    mockMenuGet.mockRejectedValue(new Error('CMS service error'));

    const handler = (await import('../../../../server/api/cms/menu.get'))
      .default;
    await expect(handler(mockEvent)).rejects.toThrow('CMS service error');
  });

  it('sets Vary: cookie header for CDN locale isolation', async () => {
    mockMenuGet.mockResolvedValue({ id: 'main', items: [] });

    const handler = (await import('../../../../server/api/cms/menu.get'))
      .default;
    await handler(mockEvent);

    expect(
      globalThis.setHeader as ReturnType<typeof vi.fn>,
    ).toHaveBeenCalledWith(mockEvent, 'Vary', 'cookie');
  });
});
