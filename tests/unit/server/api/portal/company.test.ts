import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Company } from '../../../../../shared/types/company';

// ---------------------------------------------------------------------------
// Mock the company service
// ---------------------------------------------------------------------------

const mockGetCompany = vi.fn();

vi.mock('../../../../../server/services/company', () => ({
  getCompany: (...args: unknown[]) => mockGetCompany(...args),
}));

// Mock requireAuth
const mockRequireAuth = vi.fn();
vi.mock('../../../../../server/utils/auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

// Stub Nitro auto-imports
vi.stubGlobal(
  'defineEventHandler',
  (fn: (event: unknown) => Promise<unknown>) => fn,
);
vi.stubGlobal(
  'createError',
  (opts: { statusCode: number; statusMessage?: string }) => {
    const error = new Error(
      opts.statusMessage || String(opts.statusCode),
    ) as Error & {
      statusCode: number;
      statusMessage?: string;
    };
    error.statusCode = opts.statusCode;
    error.statusMessage = opts.statusMessage;
    return error;
  },
);
vi.stubGlobal('createAppError', (code: string, message?: string) => {
  const statusMap: Record<string, number> = {
    NOT_FOUND: 404,
    UNAUTHORIZED: 401,
    BAD_REQUEST: 400,
  };
  const error = new Error(message || code) as Error & {
    statusCode: number;
    code: string;
  };
  error.statusCode = statusMap[code] ?? 500;
  error.code = code;
  return error;
});
vi.stubGlobal('ErrorCode', {
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  BAD_REQUEST: 'BAD_REQUEST',
});
vi.stubGlobal('setResponseHeader', vi.fn());

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COMPANY: Company = {
  id: 'company-1',
  name: 'Acme AB',
  vatNumber: 'SE556677889900',
  exVat: false,
  limitedProductAccess: false,
  addresses: [
    {
      addressId: 'addr-1',
      companyId: 'company-1',
      email: 'info@acme.se',
      phone: null,
      company: 'Acme AB',
      firstName: null,
      lastName: null,
      careOf: null,
      addressLine1: 'Storgatan 1',
      addressLine2: null,
      addressLine3: null,
      zip: '11122',
      city: 'Stockholm',
      region: null,
      country: 'SE',
      addressType: 'BILLING',
      addressReferenceId: null,
    },
  ],
  buyers: [
    {
      id: 'buyer-1',
      firstName: 'Anna',
      lastName: 'Karlsson',
      phone: null,
      companyId: 'company-1',
      active: true,
      restrictToDedicatedPriceLists: false,
    },
  ],
};

const AUTH_TOKENS = { authToken: 'tok', refreshToken: 'ref' };

function mockEvent() {
  return {
    context: { tenant: { hostname: 'test.com' } },
  } as unknown as import('h3').H3Event;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/portal/company', () => {
  let handler: (event: unknown) => Promise<unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(AUTH_TOKENS);

    const mod = await import('../../../../../server/api/portal/company.get');
    handler = mod.default;
  });

  it('returns { company } on happy path', async () => {
    mockGetCompany.mockResolvedValue(COMPANY);

    const event = mockEvent();
    const result = await handler(event);

    expect(result).toEqual({ company: COMPANY });
  });

  it('throws 404 with COMPANY_NOT_FOUND when service returns null', async () => {
    mockGetCompany.mockResolvedValue(null);

    const event = mockEvent();
    await expect(handler(event)).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'COMPANY_NOT_FOUND',
    });
  });

  it('throws 401 when requireAuth rejects', async () => {
    const authError = new Error('Unauthorized') as Error & {
      statusCode: number;
    };
    authError.statusCode = 401;
    mockRequireAuth.mockRejectedValue(authError);

    const event = mockEvent();
    await expect(handler(event)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('calls requireAuth before getCompany', async () => {
    mockGetCompany.mockResolvedValue(COMPANY);
    const event = mockEvent();
    await handler(event);

    expect(mockRequireAuth).toHaveBeenCalledWith(event);
    expect(mockGetCompany).toHaveBeenCalledWith(event);
  });
});
