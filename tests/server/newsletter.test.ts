import { describe, it, expect, vi, beforeEach } from 'vitest';
import { subscribe } from '../../server/services/newsletter';

// Mock logger
vi.mock('../../server/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock SDK
const mockMutation = vi.fn().mockResolvedValue({ data: true });
vi.mock('../../server/services/_sdk', () => ({
  getTenantSDK: vi.fn().mockResolvedValue({
    core: {
      graphql: { mutation: (...args: unknown[]) => mockMutation(...args) },
      geinsSettings: { channel: '1', locale: 'en', market: 'se' },
    },
  }),
  getRequestChannelVariables: vi.fn().mockReturnValue({
    channelId: '1',
    languageId: 'en',
    marketId: 'se',
  }),
}));

// Mock graphql loader
vi.mock('../../server/services/graphql/loader', () => ({
  loadQuery: vi.fn().mockReturnValue('mutation subscribeToNewsletter {}'),
}));

// Stub global server utils
vi.stubGlobal(
  'createAppError',
  vi.fn((code: string, msg: string) => new Error(`${code}: ${msg}`)),
);
vi.stubGlobal('ErrorCode', { VALIDATION_ERROR: 'VALIDATION_ERROR' });
vi.stubGlobal('wrapServiceCall', async (fn: () => Promise<unknown>) => fn());

const mockEvent = {
  context: {
    tenant: { hostname: 'test.example.com', tenantId: 'test-tenant' },
  },
  node: { req: { headers: {} } },
} as unknown as import('h3').H3Event;

describe('Newsletter Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls GraphQL mutation with email and channel variables', async () => {
    await subscribe({ email: 'user@example.com' }, mockEvent);

    expect(mockMutation).toHaveBeenCalledOnce();
    expect(mockMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          email: 'user@example.com',
          channelId: '1',
          languageId: 'en',
          marketId: 'se',
        }),
      }),
    );
  });

  it('passes the loaded GraphQL query string', async () => {
    await subscribe({ email: 'test@test.com' }, mockEvent);

    expect(mockMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        queryAsString: 'mutation subscribeToNewsletter {}',
      }),
    );
  });

  it('propagates SDK errors', async () => {
    mockMutation.mockRejectedValueOnce(new Error('Network error'));

    await expect(
      subscribe({ email: 'fail@test.com' }, mockEvent),
    ).rejects.toThrow('Network error');
  });
});
