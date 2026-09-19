import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

type AnyFn = (...args: unknown[]) => unknown;

const mockGetTenantSDK = vi.fn();
const mockGetChannelVariables = vi.fn();
vi.mock('../../../../server/services/_sdk', () => ({
  getTenantSDK: (...args: unknown[]) => mockGetTenantSDK(...args),
  getChannelVariables: (...args: unknown[]) => mockGetChannelVariables(...args),
}));

vi.mock('../../../../server/services/graphql/loader', () => ({
  loadQuery: vi.fn(() => ''),
}));
vi.mock('../../../../server/services/graphql/unwrap', () => ({
  unwrapGraphQL: vi.fn((v: unknown) => v),
}));

const mockLoggerError = vi.fn();
vi.mock('../../../../server/utils/logger', () => ({
  logger: {
    error: mockLoggerError,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.stubGlobal('defineEventHandler', (fn: AnyFn) => fn);
// Not exercised in these tests — getTenantSDK rejects before any query runs
// — but urls.ts references it via Nitro auto-import, so it must exist.
vi.stubGlobal('wrapServiceCall', vi.fn());

const handler = (await import('../../../../server/api/__sitemap__/urls'))
  .default as AnyFn;

function makeEvent(hostname = 'broken-tenant.example.com'): H3Event {
  return {
    context: {
      tenant: {
        hostname,
        config: {
          geinsSettings: {
            availableMarkets: ['se'],
            availableLocales: ['sv-SE'],
          },
        },
      },
    },
  } as unknown as H3Event;
}

/** A caught error shaped like the H3Error mapEnvironment() throws for a bad tenant environment. */
function tenantConfigInvalidError(): Error & {
  statusCode: number;
  data: { code: string };
} {
  const err = new Error(
    'Unknown Geins environment: "dev". Expected "production" or "staging".',
  ) as Error & { statusCode: number; data: { code: string } };
  err.statusCode = 500;
  err.data = { code: 'TENANT_CONFIG_INVALID' };
  return err;
}

describe('server/api/__sitemap__/urls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to root-only entries without extra logging when the API is unreachable', async () => {
    mockGetTenantSDK.mockRejectedValue(new Error('fetch failed'));

    const entries = (await handler(makeEvent())) as Array<{ loc: string }>;

    expect(entries).toEqual([
      { loc: '/se/sv/', changefreq: 'daily', priority: 1.0 },
    ]);
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it('still falls back to root-only entries but logs distinctly on a broken tenant config', async () => {
    const error = tenantConfigInvalidError();
    mockGetTenantSDK.mockRejectedValue(error);

    const entries = (await handler(
      makeEvent('broken-tenant.example.com'),
    )) as Array<{ loc: string }>;

    // Same fail-safe fallback as an unreachable API — root-only entries.
    expect(entries).toEqual([
      { loc: '/se/sv/', changefreq: 'daily', priority: 1.0 },
    ]);
    // But logged distinctly, unlike ordinary API flakiness above — this is
    // an ongoing SEO regression for the tenant until its config is fixed.
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.stringContaining('Tenant config invalid'),
      error,
      expect.objectContaining({ hostname: 'broken-tenant.example.com' }),
    );
  });
});
