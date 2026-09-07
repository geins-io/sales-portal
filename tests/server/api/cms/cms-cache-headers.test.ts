import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock CMS service layer (external boundary)
// ---------------------------------------------------------------------------
const mockGetPage = vi.fn().mockResolvedValue({
  containers: [{ widgets: [] }],
});
const mockGetContentArea = vi.fn().mockResolvedValue({
  containers: [{ widgets: [] }],
});
const mockGetMenu = vi.fn().mockResolvedValue({ id: 'main', menuItems: [] });
const mockGetPageLinkByTag = vi.fn().mockResolvedValue('/se/sv/kontakt');

vi.mock('../../../../server/services/cms', () => ({
  getPage: (...args: unknown[]) => mockGetPage(...args),
  getContentArea: (...args: unknown[]) => mockGetContentArea(...args),
  getMenu: (...args: unknown[]) => mockGetMenu(...args),
  getPageLinkByTag: (...args: unknown[]) => mockGetPageLinkByTag(...args),
}));

vi.mock('../../../../server/schemas/api-input', () => ({
  CmsPageSchema: { parse: (v: unknown) => v },
  CmsAreaSchema: { parse: (v: unknown) => v },
  CmsMenuSchema: { parse: (v: unknown) => v },
  CmsPageLinkSchema: { parse: (v: unknown) => v },
}));

vi.mock('../../../../server/utils/cms-sanitize', () => ({
  sanitizeCmsPage: (v: unknown) => v,
  sanitizeCmsArea: (v: unknown) => v,
}));

// ---------------------------------------------------------------------------
// Stub Nitro / H3 auto-imports
// ---------------------------------------------------------------------------
const getCustomerTypeMock = vi.fn();
const setHeaderMock = vi.fn();

// hasUserToken runs for real — the header follows the request's auth cookie —
// so getCookie has to answer from the mock event.
type CookieBag = { _cookies?: Record<string, string | undefined> };
const getCookieStub = (event: CookieBag, name: string) =>
  event?._cookies?.[name];

function stubCommonGlobals() {
  vi.stubGlobal('getCustomerType', getCustomerTypeMock);
  vi.stubGlobal('setHeader', setHeaderMock);
  vi.stubGlobal('getCookie', getCookieStub);
  vi.stubGlobal('withErrorHandling', async (fn: () => Promise<unknown>) =>
    fn(),
  );
  vi.stubGlobal('createAppError', (code: string, msg: string) => {
    const err = new Error(msg);
    (err as Record<string, unknown>).statusCode = code;
    return err;
  });
  vi.stubGlobal('ErrorCode', { NOT_FOUND: 'NOT_FOUND' });
  vi.stubGlobal(
    'getRouterParam',
    (_event: unknown, _name: string) => 'test-alias',
  );
  vi.stubGlobal('defineEventHandler', (fn: (event: unknown) => unknown) => fn);
}

stubCommonGlobals();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mockEvent(authToken?: string) {
  return {
    context: { tenant: { hostname: 'test.com' } },
    _cookies: { auth_token: authToken },
  } as unknown as import('h3').H3Event;
}

// The Merchant API filters CMS content by the account behind the caller's
// token, so a response fetched under one must not be kept by any shared cache
// downstream. The condition is "a token was sent", not "a customer type
// resolved" — customer type is not the axis the API filters on.

// ---------------------------------------------------------------------------
// Page route — cache headers
// ---------------------------------------------------------------------------
describe('CMS page route — cache headers', () => {
  let pageHandler: (event: import('h3').H3Event) => Promise<unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    stubCommonGlobals();
    getCustomerTypeMock.mockResolvedValue(undefined);
    mockGetPage.mockResolvedValue({ containers: [{ widgets: [] }] });

    const mod = await import('../../../../server/api/cms/page/[alias].get');
    pageHandler = mod.default as (
      event: import('h3').H3Event,
    ) => Promise<unknown>;
  });

  it('sets private, no-store for a request carrying an auth token', async () => {
    const event = mockEvent('token-a');

    await pageHandler(event);

    expect(setHeaderMock).toHaveBeenCalledWith(
      event,
      'Cache-Control',
      'private, no-store',
    );
    expect(setHeaderMock).not.toHaveBeenCalledWith(
      event,
      'Vary',
      expect.anything(),
    );
  });

  it('sets private, no-cache for an anonymous request', async () => {
    const event = mockEvent();

    await pageHandler(event);

    expect(setHeaderMock).toHaveBeenCalledWith(
      event,
      'Cache-Control',
      'private, no-cache',
    );
  });

  it('does not let a resolved customer type decide the header', async () => {
    // getCustomerType is still read for the service args; it must no longer
    // drive the header.
    getCustomerTypeMock.mockResolvedValue('PersonType');
    const event = mockEvent();

    await pageHandler(event);

    expect(setHeaderMock).toHaveBeenCalledWith(
      event,
      'Cache-Control',
      'private, no-cache',
    );
  });
});

// ---------------------------------------------------------------------------
// Area route — cache headers
// ---------------------------------------------------------------------------
describe('CMS area route — cache headers', () => {
  let areaHandler: (event: import('h3').H3Event) => Promise<unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    stubCommonGlobals();
    vi.stubGlobal(
      'getValidatedQuery',
      async (_event: unknown, parseFn: (v: unknown) => unknown) =>
        parseFn({ family: 'StartPage', areaName: 'Hero' }),
    );
    getCustomerTypeMock.mockResolvedValue(undefined);
    mockGetContentArea.mockResolvedValue({ containers: [{ widgets: [] }] });

    const mod = await import('../../../../server/api/cms/area.get');
    areaHandler = mod.default as (
      event: import('h3').H3Event,
    ) => Promise<unknown>;
  });

  it('sets private, no-store for a request carrying an auth token', async () => {
    const event = mockEvent('token-a');

    await areaHandler(event);

    expect(setHeaderMock).toHaveBeenCalledWith(
      event,
      'Cache-Control',
      'private, no-store',
    );
    expect(setHeaderMock).not.toHaveBeenCalledWith(
      event,
      'Vary',
      expect.anything(),
    );
  });

  it('sets private, no-cache for an anonymous request', async () => {
    const event = mockEvent();

    await areaHandler(event);

    expect(setHeaderMock).toHaveBeenCalledWith(
      event,
      'Cache-Control',
      'private, no-cache',
    );
  });

  it('does not let a resolved customer type decide the header', async () => {
    getCustomerTypeMock.mockResolvedValue('PersonType');
    const event = mockEvent();

    await areaHandler(event);

    expect(setHeaderMock).toHaveBeenCalledWith(
      event,
      'Cache-Control',
      'private, no-cache',
    );
  });
});

// ---------------------------------------------------------------------------
// Menu route — same rule: the menu query carries the caller's token
// ---------------------------------------------------------------------------
describe('CMS menu route — cache headers', () => {
  let menuHandler: (event: import('h3').H3Event) => Promise<unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    stubCommonGlobals();
    vi.stubGlobal(
      'getValidatedQuery',
      async (_event: unknown, parseFn: (v: unknown) => unknown) =>
        parseFn({ menuLocationId: 'main' }),
    );
    mockGetMenu.mockResolvedValue({ id: 'main', menuItems: [] });

    const mod = await import('../../../../server/api/cms/menu.get');
    menuHandler = mod.default as (
      event: import('h3').H3Event,
    ) => Promise<unknown>;
  });

  it('sets private, no-store for a request carrying an auth token', async () => {
    const event = mockEvent('token-a');

    await menuHandler(event);

    expect(setHeaderMock).toHaveBeenCalledWith(
      event,
      'Cache-Control',
      'private, no-store',
    );
  });

  it('sets private, no-cache for an anonymous request', async () => {
    const event = mockEvent();

    await menuHandler(event);

    expect(setHeaderMock).toHaveBeenCalledWith(
      event,
      'Cache-Control',
      'private, no-cache',
    );
  });
});

// ---------------------------------------------------------------------------
// Page-link route — deliberately outside the rule
// ---------------------------------------------------------------------------
describe('CMS page-link route — cache headers', () => {
  let pageLinkHandler: (event: import('h3').H3Event) => Promise<unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    stubCommonGlobals();
    vi.stubGlobal(
      'getValidatedQuery',
      async (_event: unknown, parseFn: (v: unknown) => unknown) =>
        parseFn({ tag: 'contact' }),
    );
    mockGetPageLinkByTag.mockResolvedValue('/se/sv/kontakt');

    const mod = await import('../../../../server/api/cms/page-link.get');
    pageLinkHandler = mod.default as (
      event: import('h3').H3Event,
    ) => Promise<unknown>;
  });

  // The cmsPages query is sent without the caller's token, so this response
  // cannot vary by caller and no-store would buy nothing.
  it('stays private, no-cache even for a request carrying an auth token', async () => {
    const event = mockEvent('token-a');

    await pageLinkHandler(event);

    expect(setHeaderMock).toHaveBeenCalledWith(
      event,
      'Cache-Control',
      'private, no-cache',
    );
  });
});
