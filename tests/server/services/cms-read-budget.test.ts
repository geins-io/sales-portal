import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

// A per-call budget measures our own event-loop delay as well as Geins, so an
// overloaded server cut CMS reads that Geins answered in time. Every CMS read
// takes the client's limit, the same as any other Geins call.

vi.mock('../../../server/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockAreaGet = vi.fn();
const mockPageGet = vi.fn();
const mockMenuGet = vi.fn();

vi.mock('../../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue({
    cms: {
      area: { get: (...args: unknown[]) => mockAreaGet(...args) },
      page: { get: (...args: unknown[]) => mockPageGet(...args) },
      menu: { get: (...args: unknown[]) => mockMenuGet(...args) },
    },
  }),
  getRequestChannelVariables: vi
    .fn()
    .mockReturnValue({ channelId: '1', languageId: 'sv-SE', marketId: 'se' }),
  buildRequestContext: vi.fn().mockReturnValue({ languageId: 'sv-SE' }),
}));

const getPreviewCookieMock = vi.fn().mockReturnValue(false);
vi.stubGlobal('getPreviewCookie', getPreviewCookieMock);
vi.stubGlobal('getCookie', () => undefined);
vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());
vi.stubGlobal('getRequestLocale', vi.fn().mockReturnValue(undefined));
vi.stubGlobal('getRequestMarket', vi.fn().mockReturnValue(undefined));
vi.stubGlobal('getRequestHeader', vi.fn().mockReturnValue(undefined));

const { getContentArea, getPage, getMenu } =
  await import('../../../server/services/cms');
const event = {} as H3Event;

/** How many arguments each call passed: a third one is a per-call limit. */
function argCounts(mock: ReturnType<typeof vi.fn>): number[] {
  return mock.mock.calls.map((call) => call.length);
}

describe('CMS reads ask for no limit of their own', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPreviewCookieMock.mockReturnValue(false);
    mockMenuGet.mockResolvedValue({ menuItems: [{ id: 1 }] });
    mockPageGet.mockResolvedValue({ alias: 'about' });
    mockAreaGet.mockResolvedValue({ containers: [] });
  });

  it('the menu read', async () => {
    await getMenu({ menuLocationId: 'budget-menu' }, event);

    expect(argCounts(mockMenuGet)).toEqual([2]);
  });

  it("the menu's language fallback read too", async () => {
    mockMenuGet.mockResolvedValueOnce({ menuItems: [] });

    await getMenu({ menuLocationId: 'budget-menu-fallback' }, event);

    expect(argCounts(mockMenuGet)).toEqual([2, 2]);
  });

  it('the preview menu read too', async () => {
    getPreviewCookieMock.mockReturnValue(true);

    await getMenu({ menuLocationId: 'budget-menu-preview' }, event);

    expect(argCounts(mockMenuGet)).toEqual([2]);
  });

  it('the page read too', async () => {
    await getPage({ alias: 'budget-page' }, event);

    expect(argCounts(mockPageGet)).toEqual([2]);
  });

  it('both display-setting legs of an area read', async () => {
    await getContentArea({ family: 'Budget', areaName: 'Top' }, event);

    expect(argCounts(mockAreaGet)).toEqual([2, 2]);
  });
});
