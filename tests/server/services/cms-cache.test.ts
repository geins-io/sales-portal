import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock at the SDK boundary
// ---------------------------------------------------------------------------
const mockMenuGet = vi.fn();
const mockAreaGet = vi.fn();

const mockSDK = {
  core: {
    geinsSettings: { channel: '1', locale: 'sv-SE', market: 'se' },
  },
  cms: {
    menu: { get: mockMenuGet },
    area: { get: mockAreaGet },
  },
};

vi.mock('../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue(mockSDK),
  getChannelVariables: vi.fn(),
  getRequestChannelVariables: vi
    .fn()
    .mockReturnValue({ channelId: '1', languageId: 'sv-SE', marketId: 'se' }),
  buildRequestContext: vi.fn().mockReturnValue(undefined),
}));

// ---------------------------------------------------------------------------
// Stub Nitro auto-imports
// ---------------------------------------------------------------------------
const getRequestLocaleMock = vi.fn();
const getRequestMarketMock = vi.fn();

vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());
vi.stubGlobal('getPreviewCookie', vi.fn().mockReturnValue(false));
vi.stubGlobal('getRequestLocale', getRequestLocaleMock);
vi.stubGlobal('getRequestMarket', getRequestMarketMock);
vi.stubGlobal('getCustomerType', vi.fn().mockResolvedValue(undefined));
vi.stubGlobal('getRequestHeader', vi.fn().mockReturnValue(undefined));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mockEvent(hostname = 'test.com') {
  return {
    context: { tenant: { hostname } },
  } as unknown as import('h3').H3Event;
}

describe('CMS cache — locale isolation', () => {
  let getMenu: typeof import('../../../server/services/cms').getMenu;
  let getContentArea: typeof import('../../../server/services/cms').getContentArea;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Re-stub after resetModules
    vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) =>
      fn(),
    );
    vi.stubGlobal('getPreviewCookie', vi.fn().mockReturnValue(false));
    vi.stubGlobal('getRequestLocale', getRequestLocaleMock);
    vi.stubGlobal('getRequestMarket', getRequestMarketMock);
    vi.stubGlobal('getCustomerType', vi.fn().mockResolvedValue(undefined));
    vi.stubGlobal('getRequestHeader', vi.fn().mockReturnValue(undefined));

    const mod = await import('../../../server/services/cms');
    getMenu = mod.getMenu;
    getContentArea = mod.getContentArea;
  });

  it('produces different cache keys for different locales', async () => {
    const svMenu = { id: 'main', menuItems: [{ title: 'Hem' }] };
    const enMenu = { id: 'main', menuItems: [{ title: 'Home' }] };

    // First request — Swedish locale
    getRequestLocaleMock.mockReturnValue('sv-SE');
    getRequestMarketMock.mockReturnValue('se');
    mockMenuGet.mockResolvedValue(svMenu);

    const result1 = await getMenu({ menuLocationId: 'main' }, mockEvent());
    expect(result1).toEqual(svMenu);

    // Second request — English locale, should NOT return Swedish cached data
    getRequestLocaleMock.mockReturnValue('en-US');
    getRequestMarketMock.mockReturnValue('se');
    mockMenuGet.mockResolvedValue(enMenu);

    const result2 = await getMenu({ menuLocationId: 'main' }, mockEvent());
    expect(result2).toEqual(enMenu);
    expect(result2).not.toEqual(svMenu);
    // SDK called twice — no cross-locale cache hit
    expect(mockMenuGet).toHaveBeenCalledTimes(2);
  });

  it('returns cached data for same locale', async () => {
    const menu = { id: 'main', menuItems: [{ title: 'Hem' }] };

    getRequestLocaleMock.mockReturnValue('sv-SE');
    getRequestMarketMock.mockReturnValue('se');
    mockMenuGet.mockResolvedValue(menu);

    await getMenu({ menuLocationId: 'main' }, mockEvent());
    const result2 = await getMenu({ menuLocationId: 'main' }, mockEvent());

    expect(result2).toEqual(menu);
    // SDK should only be called once (second call served from cache)
    expect(mockMenuGet).toHaveBeenCalledTimes(1);
  });

  it('isolates cache by tenant hostname', async () => {
    const tenantAMenu = { id: 'main', menuItems: [{ title: 'Tenant A' }] };
    const tenantBMenu = { id: 'main', menuItems: [{ title: 'Tenant B' }] };

    getRequestLocaleMock.mockReturnValue('sv-SE');
    getRequestMarketMock.mockReturnValue('se');

    mockMenuGet.mockResolvedValue(tenantAMenu);
    const result1 = await getMenu(
      { menuLocationId: 'main' },
      mockEvent('tenant-a.com'),
    );

    mockMenuGet.mockResolvedValue(tenantBMenu);
    const result2 = await getMenu(
      { menuLocationId: 'main' },
      mockEvent('tenant-b.com'),
    );

    expect(result1).toEqual(tenantAMenu);
    expect(result2).toEqual(tenantBMenu);
    // SDK called twice — no cross-tenant cache hit
    expect(mockMenuGet).toHaveBeenCalledTimes(2);
  });

  it('uses default fallback when getRequestLocale returns undefined', async () => {
    const menu = { id: 'main', menuItems: [{ title: 'Default' }] };

    getRequestLocaleMock.mockReturnValue(undefined);
    getRequestMarketMock.mockReturnValue(undefined);
    mockMenuGet.mockResolvedValue(menu);

    const result = await getMenu({ menuLocationId: 'main' }, mockEvent());
    expect(result).toEqual(menu);
    expect(mockMenuGet).toHaveBeenCalledTimes(1);
  });

  it('isolates area cache by locale', async () => {
    const svArea = { containers: [{ widgets: [{ text: 'Hej' }] }] };
    const enArea = { containers: [{ widgets: [{ text: 'Hello' }] }] };

    // Swedish request
    getRequestLocaleMock.mockReturnValue('sv-SE');
    getRequestMarketMock.mockReturnValue('se');
    mockAreaGet.mockResolvedValue(svArea);

    const result1 = await getContentArea(
      { family: 'StartPage', areaName: 'Hero' },
      mockEvent(),
    );
    expect(result1).toEqual(svArea);

    // English request — should NOT get Swedish cached data
    getRequestLocaleMock.mockReturnValue('en-US');
    getRequestMarketMock.mockReturnValue('se');
    mockAreaGet.mockResolvedValue(enArea);

    const result2 = await getContentArea(
      { family: 'StartPage', areaName: 'Hero' },
      mockEvent(),
    );
    expect(result2).toEqual(enArea);
    expect(result2).not.toEqual(svArea);
  });
});
