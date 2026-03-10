import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

// Mock the logger module (auto-imported by Nitro from server/utils/logger.ts)
vi.mock('#imports', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  };
});

const mockRateLimiterCheck = vi.fn();

// Stub Nitro auto-imports that come from server/utils/
vi.stubGlobal('getClientIp', vi.fn().mockReturnValue('127.0.0.1'));
vi.stubGlobal('applyForAccountRateLimiter', { check: mockRateLimiterCheck });
vi.stubGlobal(
  'createAppError',
  vi.fn((code: string, msg: string) => {
    const err = new Error(`${code}: ${msg}`);
    (err as Error & { statusCode: number }).statusCode =
      code === 'RATE_LIMITED' ? 429 : 400;
    return err;
  }),
);
vi.stubGlobal('ErrorCode', {
  RATE_LIMITED: 'RATE_LIMITED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
});

// Helper to mock readValidatedBody
let capturedBody: Record<string, unknown> = {};
vi.stubGlobal(
  'readValidatedBody',
  vi.fn(async (_event: H3Event, parse: (data: unknown) => unknown) => {
    return parse(capturedBody);
  }),
);

// Minimal defineEventHandler shim — just returns the handler function
vi.stubGlobal('defineEventHandler', (fn: (event: H3Event) => unknown) => fn);

const validBody = {
  companyName: 'Acme Corp',
  organizationNumber: '556677-8899',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@acme.com',
  phone: '+46701234567',
  message: 'We want a wholesale account.',
};

const mockEvent = {
  node: { req: { headers: {}, socket: { remoteAddress: '127.0.0.1' } } },
} as unknown as H3Event;

describe('POST /api/apply/submit', () => {
  let handler: (event: H3Event) => Promise<unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    capturedBody = { ...validBody };
    mockRateLimiterCheck.mockResolvedValue({ allowed: true, remaining: 2 });

    if (!handler) {
      const mod = await import('../../../server/api/apply/submit.post');
      handler = mod.default as (event: H3Event) => Promise<unknown>;
    }
  });

  it('returns { ok: true } for a valid submission', async () => {
    const result = await handler(mockEvent);
    expect(result).toEqual({ ok: true });
  });

  it('throws rate limit error when too many requests', async () => {
    mockRateLimiterCheck.mockResolvedValue({ allowed: false, remaining: 0 });

    await expect(handler(mockEvent)).rejects.toThrow('RATE_LIMITED');
  });

  it('throws validation error for invalid body', async () => {
    capturedBody = {
      companyName: '',
      organizationNumber: '',
      firstName: '',
      lastName: '',
      email: 'bad',
    };

    await expect(handler(mockEvent)).rejects.toThrow();
  });
});
