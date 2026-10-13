import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

// Every CMS read a render waits on has a fallback when it fails, so each one
// asks the SDK for the short CMS budget instead of the client's 20 s.

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
const { CMS_READ_TIMEOUT_MS } =
  await import('../../../server/utils/outbound-timeouts');

const BUDGET = { timeoutMs: CMS_READ_TIMEOUT_MS };
const event = {} as H3Event;

function budgets(mock: ReturnType<typeof vi.fn>): unknown[] {
  return mock.mock.calls.map((call) => call[2]);
}

describe('CMS reads ask for the CMS budget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPreviewCookieMock.mockReturnValue(false);
    mockMenuGet.mockResolvedValue({ menuItems: [{ id: 1 }] });
    mockPageGet.mockResolvedValue({ alias: 'about' });
    mockAreaGet.mockResolvedValue({ containers: [] });
  });

  it('the menu read', async () => {
    await getMenu({ menuLocationId: 'budget-menu' }, event);

    expect(budgets(mockMenuGet)).toEqual([BUDGET]);
  });

  it("the menu's language fallback read too", async () => {
    mockMenuGet.mockResolvedValueOnce({ menuItems: [] });

    await getMenu({ menuLocationId: 'budget-menu-fallback' }, event);

    expect(budgets(mockMenuGet)).toEqual([BUDGET, BUDGET]);
  });

  it('the preview menu read too', async () => {
    getPreviewCookieMock.mockReturnValue(true);

    await getMenu({ menuLocationId: 'budget-menu-preview' }, event);

    expect(budgets(mockMenuGet)).toEqual([BUDGET]);
  });

  it('but not the page read: without it the page is the error page', async () => {
    await getPage({ alias: 'budget-page' }, event);

    expect(budgets(mockPageGet)).toEqual([undefined]);
    expect(mockPageGet.mock.calls[0]).toHaveLength(2);
  });

  it('both display-setting legs of an area read', async () => {
    await getContentArea({ family: 'Budget', areaName: 'Top' }, event);

    expect(budgets(mockAreaGet)).toEqual([BUDGET, BUDGET]);
  });
});
