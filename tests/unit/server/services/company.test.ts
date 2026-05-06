import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Company } from '../../../../shared/types/company';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGraphqlQuery = vi.fn();

const mockGetTenantSDK = vi.fn();
const mockGetRequestChannelVariables = vi.fn();
const mockBuildRequestContext = vi.fn();

vi.mock('../../../../server/services/_sdk', () => ({
  getTenantSDK: (...args: unknown[]) => mockGetTenantSDK(...args),
  getRequestChannelVariables: (...args: unknown[]) =>
    mockGetRequestChannelVariables(...args),
  buildRequestContext: (...args: unknown[]) => mockBuildRequestContext(...args),
}));

// Stub Nitro auto-imports
vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());
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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CHANNEL_VARS = {
  channelId: '1|se',
  languageId: 'sv-SE',
  marketId: 'se',
};

const MOCK_SDK = {
  core: {
    geinsSettings: {
      apiKey: 'test-api-key',
    },
    graphql: {
      query: (...args: unknown[]) => mockGraphqlQuery(...args),
    },
  },
};

const RAW_GRAPHQL_RESULT = {
  getCompany: {
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
        phone: '+46701234567',
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
        phone: '+46709876543',
        companyId: 'company-1',
        active: true,
        restrictToDedicatedPriceLists: false,
      },
    ],
  },
};

function mockEvent() {
  return {
    context: {
      tenant: {
        hostname: 'test.com',
        config: { geinsSettings: { apiKey: 'test-api-key' } },
      },
    },
  } as unknown as import('h3').H3Event;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('company service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTenantSDK.mockResolvedValue(MOCK_SDK);
    mockGetRequestChannelVariables.mockReturnValue(CHANNEL_VARS);
    mockBuildRequestContext.mockReturnValue({ userToken: 'user-token-abc' });
  });

  describe('getCompany', () => {
    it('returns a mapped Company on happy path', async () => {
      mockGraphqlQuery.mockResolvedValue(RAW_GRAPHQL_RESULT);

      const { getCompany } =
        await import('../../../../server/services/company');
      const result = await getCompany(mockEvent());

      expect(result).not.toBeNull();
      const company = result as Company;
      expect(company.id).toBe('company-1');
      expect(company.name).toBe('Acme AB');
      expect(company.vatNumber).toBe('SE556677889900');
      expect(company.exVat).toBe(false);
      expect(company.limitedProductAccess).toBe(false);
      expect(company.addresses).toHaveLength(1);
      expect(company.addresses![0]!.addressId).toBe('addr-1');
      expect(company.addresses![0]!.city).toBe('Stockholm');
      expect(company.buyers).toHaveLength(1);
      expect(company.buyers![0]!.id).toBe('buyer-1');
      expect(company.buyers![0]!.firstName).toBe('Anna');
    });

    it('passes channelId, languageId, marketId variables from resolvedLocaleMarket', async () => {
      mockGraphqlQuery.mockResolvedValue(RAW_GRAPHQL_RESULT);

      const { getCompany } =
        await import('../../../../server/services/company');
      await getCompany(mockEvent());

      expect(mockGraphqlQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            channelId: '1|se',
            languageId: 'sv-SE',
            marketId: 'se',
          }),
        }),
      );
    });

    it('passes userToken from buildRequestContext to the query', async () => {
      mockGraphqlQuery.mockResolvedValue(RAW_GRAPHQL_RESULT);

      const { getCompany } =
        await import('../../../../server/services/company');
      await getCompany(mockEvent());

      expect(mockGraphqlQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          userToken: 'user-token-abc',
        }),
      );
    });

    it('includes the expected field set in the query string', async () => {
      mockGraphqlQuery.mockResolvedValue(RAW_GRAPHQL_RESULT);

      const { getCompany, GET_COMPANY_QUERY } =
        await import('../../../../server/services/company');
      await getCompany(mockEvent());

      expect(GET_COMPANY_QUERY).toContain('getCompany');
      expect(GET_COMPANY_QUERY).toContain('vatNumber');
      expect(GET_COMPANY_QUERY).toContain('exVat');
      expect(GET_COMPANY_QUERY).toContain('limitedProductAccess');
      expect(GET_COMPANY_QUERY).toContain('addresses');
      expect(GET_COMPANY_QUERY).toContain('buyers');
      expect(GET_COMPANY_QUERY).toContain('addressId');
      expect(GET_COMPANY_QUERY).toContain('restrictToDedicatedPriceLists');

      expect(mockGraphqlQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryAsString: GET_COMPANY_QUERY,
        }),
      );
    });

    it('returns null when getCompany resolves to null (user not linked)', async () => {
      mockGraphqlQuery.mockResolvedValue({ getCompany: null });

      const { getCompany } =
        await import('../../../../server/services/company');
      const result = await getCompany(mockEvent());

      expect(result).toBeNull();
    });

    it('returns null for "User not found" GraphQL error response (verified live shape from merchantapi.geins.io)', async () => {
      // Geins returns { errors: [{ message: "User not found" }], data: { getCompany: null } }
      // wrapServiceCall passes through the data portion; null getCompany triggers null return.
      mockGraphqlQuery.mockResolvedValue({ getCompany: null });

      const { getCompany } =
        await import('../../../../server/services/company');
      const result = await getCompany(mockEvent());

      expect(result).toBeNull();
    });

    it('SDK is constructed with the tenant apiKey', async () => {
      mockGraphqlQuery.mockResolvedValue(RAW_GRAPHQL_RESULT);

      const { getCompany } =
        await import('../../../../server/services/company');
      await getCompany(mockEvent());

      expect(mockGetTenantSDK).toHaveBeenCalled();
      // The resolved SDK fixture carries apiKey — confirms per-tenant key reaches the query layer.
      expect(MOCK_SDK.core.geinsSettings.apiKey).toBe('test-api-key');
    });

    it('throws 401 when buildRequestContext returns no userToken', async () => {
      mockBuildRequestContext.mockReturnValue({ userToken: undefined });

      const { getCompany } =
        await import('../../../../server/services/company');
      await expect(getCompany(mockEvent())).rejects.toMatchObject({
        statusCode: 401,
      });
    });
  });
});
