import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock at the SDK boundary — the 404 for an unresolved area is deliberately
// silent (logged at info level), so these assert on the arguments that reach
// sdk.cms.area.get rather than on the response.
// ---------------------------------------------------------------------------
const mockAreaGet = vi.fn();

const mockSDK = {
  core: { geinsSettings: { channel: '1', locale: 'sv-SE', market: 'se' } },
  cms: { menu: { get: vi.fn() }, area: { get: mockAreaGet } },
};

vi.mock('../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue(mockSDK),
  getChannelVariables: vi.fn(),
  getRequestChannelVariables: vi
    .fn()
    .mockReturnValue({ channelId: '1', languageId: 'sv-SE', marketId: 'se' }),
  buildRequestContext: vi.fn().mockReturnValue(undefined),
}));

const getRequestLocaleMock = vi.fn().mockReturnValue('sv-SE');
const getRequestMarketMock = vi.fn().mockReturnValue('se');
const getCookieStub = () => undefined;

function stubGlobals() {
  vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());
  vi.stubGlobal('getPreviewCookie', vi.fn().mockReturnValue(false));
  vi.stubGlobal('getRequestLocale', getRequestLocaleMock);
  vi.stubGlobal('getRequestMarket', getRequestMarketMock);
  vi.stubGlobal('getCustomerType', vi.fn().mockResolvedValue(undefined));
  vi.stubGlobal('getRequestHeader', vi.fn().mockReturnValue(undefined));
  vi.stubGlobal('getCookie', getCookieStub);
}

stubGlobals();

function mockEvent(hostname = 'test.com') {
  return {
    context: { tenant: { hostname } },
    _cookies: {},
  } as unknown as import('h3').H3Event;
}

const AREA = { containers: [{ id: '1', content: [{ config: {} }] }] };

describe('getContentArea — page-context filters', () => {
  let getContentArea: typeof import('../../../server/services/cms').getContentArea;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    stubGlobals();
    mockAreaGet.mockResolvedValue(AREA);
    const mod = await import('../../../server/services/cms');
    getContentArea = mod.getContentArea;
  });

  it('sends product, brand and every category id as filters', async () => {
    await getContentArea(
      {
        family: 'Product',
        areaName: 'Below Details',
        context: {
          productAlias: 'hylsnyckelsats-1-2-24-delar',
          brandAlias: 'acme',
          categoryIds: [1, 7, 9],
        },
      },
      mockEvent(),
    );

    // Both display-setting legs go out; either carries the same filters.
    expect(mockAreaGet).toHaveBeenCalled();
    const [vars] = mockAreaGet.mock.calls[0] as [Record<string, unknown>];
    expect(vars.filters).toEqual([
      { key: 'Product', value: 'hylsnyckelsats-1-2-24-delar' },
      { key: 'Brand', value: 'acme' },
      { key: 'Category', value: '1' },
      { key: 'Category', value: '7' },
      { key: 'Category', value: '9' },
    ]);
  });

  it('sends no filters argument when the surface has no page context', async () => {
    await getContentArea(
      { family: 'Frontpage', areaName: 'Content' },
      mockEvent(),
    );

    const [vars] = mockAreaGet.mock.calls[0] as [Record<string, unknown>];
    expect(vars).not.toHaveProperty('filters');
    expect(vars).not.toHaveProperty('context');
  });

  it('caps the category ids it forwards', async () => {
    await getContentArea(
      {
        family: 'Product',
        areaName: 'Below Details',
        context: { categoryIds: Array.from({ length: 30 }, (_, i) => i + 1) },
      },
      mockEvent(),
    );

    const [vars] = mockAreaGet.mock.calls[0] as [Record<string, unknown>];
    expect((vars.filters as unknown[]).length).toBe(20);
  });

  it('gives two products two cache entries', async () => {
    const one = {
      family: 'Product',
      areaName: 'Below Details',
      context: { productAlias: 'product-one' },
    };
    const two = {
      family: 'Product',
      areaName: 'Below Details',
      context: { productAlias: 'product-two' },
    };

    await getContentArea(one, mockEvent());
    const afterFirst = mockAreaGet.mock.calls.length;

    await getContentArea(two, mockEvent());
    expect(mockAreaGet.mock.calls.length).toBeGreaterThan(afterFirst);

    // Same product again is served from cache — no further SDK calls.
    const beforeRepeat = mockAreaGet.mock.calls.length;
    await getContentArea(one, mockEvent());
    expect(mockAreaGet.mock.calls.length).toBe(beforeRepeat);
  });

  it('does not let a filtered area answer an unfiltered request', async () => {
    const filtered = {
      family: 'Product',
      areaName: 'Below Details',
      context: { productAlias: 'product-one' },
    };
    const bare = { family: 'Product', areaName: 'Below Details' };

    await getContentArea(filtered, mockEvent());
    const afterFiltered = mockAreaGet.mock.calls.length;

    await getContentArea(bare, mockEvent());
    expect(mockAreaGet.mock.calls.length).toBeGreaterThan(afterFiltered);
  });
});
