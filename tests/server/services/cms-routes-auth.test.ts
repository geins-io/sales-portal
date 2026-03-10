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

vi.mock('../../../server/services/cms', () => ({
  getPage: (...args: unknown[]) => mockGetPage(...args),
  getContentArea: (...args: unknown[]) => mockGetContentArea(...args),
}));

vi.mock('../../../server/schemas/api-input', () => ({
  CmsPageSchema: { parse: (v: unknown) => v },
  CmsAreaSchema: { parse: (v: unknown) => v },
}));

vi.mock('../../../server/utils/cms-sanitize', () => ({
  sanitizeCmsPage: (v: unknown) => v,
  sanitizeCmsArea: (v: unknown) => v,
}));

// ---------------------------------------------------------------------------
// Stub Nitro / H3 auto-imports
// ---------------------------------------------------------------------------
const getCustomerTypeMock = vi.fn();
vi.stubGlobal('getCustomerType', getCustomerTypeMock);

vi.stubGlobal('withErrorHandling', async (fn: () => Promise<unknown>) => fn());
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
    vi.stubGlobal(
      'defineEventHandler',
      (fn: (event: unknown) => unknown) => fn,
    );

    mockGetPage.mockResolvedValue({ containers: [{ widgets: [] }] });

    const mod = await import('../../../server/api/cms/page/[alias].get');
    pageHandler = mod.default as (
      event: import('h3').H3Event,
    ) => Promise<unknown>;
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
      'getValidatedQuery',
      async (_event: unknown, parseFn: (v: unknown) => unknown) =>
        parseFn({ family: 'StartPage', areaName: 'Hero' }),
    );
    vi.stubGlobal(
      'defineEventHandler',
      (fn: (event: unknown) => unknown) => fn,
    );

    mockGetContentArea.mockResolvedValue({ containers: [{ widgets: [] }] });

    const mod = await import('../../../server/api/cms/area.get');
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
