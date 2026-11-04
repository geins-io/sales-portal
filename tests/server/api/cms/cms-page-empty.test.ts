import { describe, it, expect, vi, beforeEach } from 'vitest';

// Geins answers no widget area for a published page without blocks, the same
// as for a missing page; the route tells them apart through `cmsPages`.
const mockGetPage = vi.fn();
const mockGetListedCmsPage = vi.fn();
const mockSafeParse = vi.fn();

vi.mock('../../../../server/services/cms', () => ({
  getPage: (...args: unknown[]) => mockGetPage(...args),
  getListedCmsPage: (...args: unknown[]) => mockGetListedCmsPage(...args),
}));

vi.mock('../../../../server/schemas/api-input', () => ({
  CmsPageSchema: { safeParse: (v: unknown) => mockSafeParse(v) },
}));

vi.mock('../../../../server/utils/cms-sanitize', () => ({
  sanitizeCmsPage: (v: unknown) => v,
}));

function stubGlobals() {
  vi.stubGlobal('getCustomerType', vi.fn().mockResolvedValue(undefined));
  vi.stubGlobal('setHeader', vi.fn());
  vi.stubGlobal('getCookie', vi.fn());
  vi.stubGlobal('withErrorHandling', async (fn: () => Promise<unknown>) =>
    fn(),
  );
  vi.stubGlobal('createAppError', (code: string, msg: string) =>
    Object.assign(new Error(msg), { statusCode: code }),
  );
  vi.stubGlobal('ErrorCode', { NOT_FOUND: 'NOT_FOUND' });
  vi.stubGlobal('getRouterParam', () => 'tom-page-test');
  vi.stubGlobal('defineEventHandler', (fn: (event: unknown) => unknown) => fn);
}

const event = {
  context: { tenant: { hostname: 'test.com' } },
  _cookies: {},
} as unknown as import('h3').H3Event;

// What the SDK makes of a null widget area.
const NO_WIDGET_AREA = {
  id: '',
  name: '',
  title: '',
  pageArea: {},
  familyName: '',
  meta: {},
  tags: [],
  containers: [],
};

const LISTED = {
  id: 26,
  alias: 'tom-page-test',
  name: 'tom page test',
  title: 'Tom page test',
  tags: ['#menu'],
  meta: { title: 'Meta title', description: 'Meta description' },
};

describe('CMS page route: a page without blocks', () => {
  let handler: (event: import('h3').H3Event) => Promise<unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    stubGlobals();
    mockSafeParse.mockImplementation((v: unknown) => ({
      success: true,
      data: v,
    }));
    const mod = await import('../../../../server/api/cms/page/[alias].get');
    handler = mod.default as typeof handler;
  });

  it('serves a page with blocks without asking cmsPages', async () => {
    const page = { id: '1', containers: [{ widgets: [] }] };
    mockGetPage.mockResolvedValue(page);

    expect(await handler(event)).toEqual(page);
    expect(mockGetListedCmsPage).not.toHaveBeenCalled();
  });

  it('answers an empty page, named from cmsPages, when the alias is listed', async () => {
    mockGetPage.mockResolvedValue(NO_WIDGET_AREA);
    mockGetListedCmsPage.mockResolvedValue(LISTED);

    expect(await handler(event)).toEqual({
      id: '26',
      name: 'tom page test',
      title: 'Tom page test',
      meta: { title: 'Meta title', description: 'Meta description' },
      tags: ['#menu'],
      containers: [],
    });
    expect(mockGetListedCmsPage).toHaveBeenCalledWith(
      { alias: 'tom-page-test' },
      event,
    );
  });

  it('falls back to the name for the title, and to an empty meta', async () => {
    mockGetPage.mockResolvedValue(NO_WIDGET_AREA);
    mockGetListedCmsPage.mockResolvedValue({
      ...LISTED,
      title: null,
      meta: { title: null, description: null },
    });

    expect(await handler(event)).toMatchObject({
      title: 'tom page test',
      meta: { title: undefined, description: undefined },
    });
  });

  it('answers an empty meta when the item has none', async () => {
    mockGetPage.mockResolvedValue(NO_WIDGET_AREA);
    mockGetListedCmsPage.mockResolvedValue({ ...LISTED, meta: null });

    const page = (await handler(event)) as { meta: unknown };

    expect(page.meta).toEqual({});
  });

  it.each([
    ['no page object', null],
    ['a page without containers', { id: '' }],
  ])('asks cmsPages when getPage answers %s', async (_label, answer) => {
    mockGetPage.mockResolvedValue(answer);
    mockGetListedCmsPage.mockResolvedValue(LISTED);

    expect(await handler(event)).toMatchObject({ id: '26' });
  });

  // A failed or malformed cmsPages read reaches the route as null (the service
  // warns and does not cache it), so it is the same 404 as "not listed".
  it('answers 404 when the alias is not listed, or the read failed', async () => {
    mockGetPage.mockResolvedValue(NO_WIDGET_AREA);
    mockGetListedCmsPage.mockResolvedValue(null);

    await expect(handler(event)).rejects.toMatchObject({
      statusCode: 'NOT_FOUND',
    });
  });

  it('answers 404 for an alias that does not parse, with no Geins call', async () => {
    mockSafeParse.mockReturnValue({ success: false });

    await expect(handler(event)).rejects.toMatchObject({
      statusCode: 'NOT_FOUND',
    });
    expect(mockGetPage).not.toHaveBeenCalled();
    expect(mockGetListedCmsPage).not.toHaveBeenCalled();
  });
});
