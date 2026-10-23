import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeinsCustomerType } from '@geins/types';

// ---------------------------------------------------------------------------
// Mock CMS service layer (external boundary)
// ---------------------------------------------------------------------------
const mockGetPage = vi.fn().mockResolvedValue({
  containers: [{ widgets: [] }],
});
const mockGetContentArea = vi.fn().mockResolvedValue({
  containers: [{ widgets: [] }],
});

vi.mock('../../../../server/services/cms', () => ({
  getPage: (...args: unknown[]) => mockGetPage(...args),
  getContentArea: (...args: unknown[]) => mockGetContentArea(...args),
}));

// The page schema runs for real: its alias limit decides the 404 case below.
vi.mock('../../../../server/schemas/api-input', async (importOriginal) => ({
  CmsPageSchema: (
    await importOriginal<
      typeof import('../../../../server/schemas/api-input')
    >()
  ).CmsPageSchema,
  CmsAreaSchema: { parse: (v: unknown) => v },
}));

vi.mock('../../../../server/utils/cms-sanitize', () => ({
  sanitizeCmsPage: (v: unknown) => v,
  sanitizeCmsArea: (v: unknown) => v,
}));

// ---------------------------------------------------------------------------
// Stub Nitro / H3 auto-imports
// ---------------------------------------------------------------------------
const getCustomerTypeMock = vi.fn();
vi.stubGlobal('getCustomerType', getCustomerTypeMock);
vi.stubGlobal('setHeader', vi.fn());
vi.stubGlobal('getCookie', () => undefined);

vi.stubGlobal('withErrorHandling', async (fn: () => Promise<unknown>) => fn());
// The status the real createAppError gives each code, so a test can assert it.
const STATUS_OF: Record<string, number> = { NOT_FOUND: 404 };
const createAppErrorStub = (code: string, msg: string) =>
  Object.assign(new Error(msg), { statusCode: STATUS_OF[code] });
vi.stubGlobal('createAppError', createAppErrorStub);
vi.stubGlobal('ErrorCode', { NOT_FOUND: 'NOT_FOUND' });
vi.stubGlobal(
  'getRouterParam',
  (_event: unknown, _name: string) => 'test-alias',
);
vi.stubGlobal(
  'getValidatedQuery',
  async (_event: unknown, parseFn: (v: unknown) => unknown) =>
    parseFn({ family: 'StartPage', areaName: 'Hero' }),
);
vi.stubGlobal('defineEventHandler', (fn: (event: unknown) => unknown) => fn);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mockEvent() {
  return {
    context: { tenant: { hostname: 'test.com' } },
  } as unknown as import('h3').H3Event;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('CMS page route — customerType threading', () => {
  let pageHandler: (event: import('h3').H3Event) => Promise<unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Re-stub globals after resetModules
    vi.stubGlobal('getCustomerType', getCustomerTypeMock);
    vi.stubGlobal('setHeader', vi.fn());
    vi.stubGlobal('getCookie', () => undefined);
    vi.stubGlobal('withErrorHandling', async (fn: () => Promise<unknown>) =>
      fn(),
    );
    vi.stubGlobal('createAppError', createAppErrorStub);
    vi.stubGlobal('ErrorCode', { NOT_FOUND: 'NOT_FOUND' });
    vi.stubGlobal(
      'getRouterParam',
      (_event: unknown, _name: string) => 'test-alias',
    );
    vi.stubGlobal(
      'defineEventHandler',
      (fn: (event: unknown) => unknown) => fn,
    );

    mockGetPage.mockResolvedValue({ containers: [{ widgets: [] }] });

    const mod = await import('../../../../server/api/cms/page/[alias].get');
    pageHandler = mod.default as (
      event: import('h3').H3Event,
    ) => Promise<unknown>;
  });

  // An alias no page can have is a miss, never a 500: the catch-all reads
  // anything but a 404 as a failed read and shows the error page.
  it('answers 404 for an over-long alias without asking Geins', async () => {
    const getAlias = vi.fn(() => 'a'.repeat(201));
    vi.stubGlobal('getRouterParam', getAlias);
    const event = mockEvent();

    await expect(pageHandler(event)).rejects.toMatchObject({
      message: 'Page not found',
      statusCode: 404,
    });
    expect(getAlias).toHaveBeenCalledWith(event, 'alias');
    expect(mockGetPage).not.toHaveBeenCalled();
  });

  // The catch-all recovers on a 404 alone, so the status is the contract.
  it('answers 404 when the CMS has no such page', async () => {
    mockGetPage.mockResolvedValue({ containers: [] });

    await expect(pageHandler(mockEvent())).rejects.toMatchObject({
      message: 'Page not found',
      statusCode: 404,
    });
  });

  it('passes ORGANIZATION customerType from getCustomerType to getPage', async () => {
    getCustomerTypeMock.mockResolvedValue(GeinsCustomerType.OrganizationType);
    const event = mockEvent();

    await pageHandler(event);

    expect(getCustomerTypeMock).toHaveBeenCalledWith(event);
    expect(mockGetPage).toHaveBeenCalledWith(
      { alias: 'test-alias', customerType: GeinsCustomerType.OrganizationType },
      event,
    );
  });

  it('passes undefined customerType for anonymous users', async () => {
    getCustomerTypeMock.mockResolvedValue(undefined);
    const event = mockEvent();

    await pageHandler(event);

    expect(getCustomerTypeMock).toHaveBeenCalledWith(event);
    expect(mockGetPage).toHaveBeenCalledWith(
      { alias: 'test-alias', customerType: undefined },
      event,
    );
  });
});

describe('CMS area route — customerType threading', () => {
  let areaHandler: (event: import('h3').H3Event) => Promise<unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Re-stub globals after resetModules
    vi.stubGlobal('getCustomerType', getCustomerTypeMock);
    vi.stubGlobal('setHeader', vi.fn());
    vi.stubGlobal('getCookie', () => undefined);
    vi.stubGlobal('withErrorHandling', async (fn: () => Promise<unknown>) =>
      fn(),
    );
    vi.stubGlobal('createAppError', (code: string, msg: string) => {
      return Object.assign(new Error(msg), { statusCode: code });
    });
    vi.stubGlobal('ErrorCode', { NOT_FOUND: 'NOT_FOUND' });
    vi.stubGlobal(
      'getValidatedQuery',
      async (_event: unknown, parseFn: (v: unknown) => unknown) =>
        parseFn({ family: 'StartPage', areaName: 'Hero' }),
    );
    vi.stubGlobal(
      'defineEventHandler',
      (fn: (event: unknown) => unknown) => fn,
    );

    mockGetContentArea.mockResolvedValue({ containers: [{ widgets: [] }] });

    const mod = await import('../../../../server/api/cms/area.get');
    areaHandler = mod.default as (
      event: import('h3').H3Event,
    ) => Promise<unknown>;
  });

  it('passes PERSON customerType from getCustomerType to getContentArea', async () => {
    getCustomerTypeMock.mockResolvedValue(GeinsCustomerType.PersonType);
    const event = mockEvent();

    await areaHandler(event);

    expect(getCustomerTypeMock).toHaveBeenCalledWith(event);
    expect(mockGetContentArea).toHaveBeenCalledWith(
      {
        family: 'StartPage',
        areaName: 'Hero',
        customerType: GeinsCustomerType.PersonType,
      },
      event,
    );
  });

  it('passes undefined customerType for anonymous users', async () => {
    getCustomerTypeMock.mockResolvedValue(undefined);
    const event = mockEvent();

    await areaHandler(event);

    expect(getCustomerTypeMock).toHaveBeenCalledWith(event);
    expect(mockGetContentArea).toHaveBeenCalledWith(
      { family: 'StartPage', areaName: 'Hero', customerType: undefined },
      event,
    );
  });
});
