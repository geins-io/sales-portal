import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

import * as userService from '../../../server/services/user';

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

// Mock the rate-limiter module so registerRateLimiter.check is controllable
// (it calls useStorage internally which is a Nitro global unavailable in tests)
vi.mock('../../../server/utils/rate-limiter', () => ({
  registerRateLimiter: { check: mockRateLimiterCheck },
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

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
  BAD_REQUEST: 'BAD_REQUEST',
});

// Stub createError (Nitro's built-in, used for 403)
vi.stubGlobal(
  'createError',
  vi.fn(
    ({
      statusCode,
      statusMessage,
    }: {
      statusCode: number;
      statusMessage?: string;
    }) => {
      const err = new Error(statusMessage ?? String(statusCode));
      (err as Error & { statusCode: number }).statusCode = statusCode;
      return err;
    },
  ),
);

// Helper to mock readValidatedBody
let capturedBody: Record<string, unknown> = {};
vi.stubGlobal(
  'readValidatedBody',
  vi.fn(async (_event: H3Event, parse: (data: unknown) => unknown) => {
    return parse(capturedBody);
  }),
);

// Stub setAuthCookies (auto-imported Nitro global)
vi.stubGlobal('setAuthCookies', vi.fn());

// Minimal defineEventHandler shim — just returns the handler function
vi.stubGlobal('defineEventHandler', (fn: (event: H3Event) => unknown) => fn);

// Mock userService
vi.mock('../../../server/services/user', () => ({
  register: vi.fn(),
}));

const validBody = {
  username: 'test@example.com',
  password: 'secret123',
  user: { firstName: 'Test', lastName: 'User' },
};

const successResult = {
  succeeded: true,
  tokens: { token: 'tok', refreshToken: 'ref', expiresIn: 3600 },
  user: { id: 'u1' },
};

function makeEvent(registrationEnabled?: boolean | undefined) {
  return {
    node: { req: { headers: {}, socket: { remoteAddress: '127.0.0.1' } } },
    context: {
      tenant:
        registrationEnabled === undefined
          ? undefined
          : {
              config: {
                features:
                  registrationEnabled === undefined
                    ? undefined
                    : { registration: { enabled: registrationEnabled } },
              },
            },
    },
  } as unknown as H3Event;
}

describe('POST /api/auth/register', () => {
  let handler: (event: H3Event) => Promise<unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    capturedBody = { ...validBody };
    mockRateLimiterCheck.mockResolvedValue({ allowed: true, remaining: 4 });
    vi.mocked(userService.register).mockResolvedValue(successResult as never);

    if (!handler) {
      const mod = await import('../../../server/api/auth/register.post');
      handler = mod.default as (event: H3Event) => Promise<unknown>;
    }
  });

  it('returns user data when registration is enabled', async () => {
    const event = makeEvent(true);
    const result = await handler(event);
    expect(result).toMatchObject({ user: { id: 'u1' } });
    expect(userService.register).toHaveBeenCalledOnce();
  });

  it('throws 403 when registration is disabled', async () => {
    const event = makeEvent(false);
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 403 });
    expect(userService.register).not.toHaveBeenCalled();
  });

  it('proceeds (fail-open) when registration key is missing from features', async () => {
    // Tenant exists but has no registration key — must default to enabled
    const event = {
      node: { req: { headers: {}, socket: { remoteAddress: '127.0.0.1' } } },
      context: {
        tenant: { config: { features: {} } },
      },
    } as unknown as H3Event;
    const result = await handler(event);
    expect(result).toMatchObject({ user: { id: 'u1' } });
    expect(userService.register).toHaveBeenCalledOnce();
  });

  it('proceeds (fail-open) when tenant context is absent', async () => {
    const event = {
      node: { req: { headers: {}, socket: { remoteAddress: '127.0.0.1' } } },
      context: {},
    } as unknown as H3Event;
    const result = await handler(event);
    expect(result).toMatchObject({ user: { id: 'u1' } });
    expect(userService.register).toHaveBeenCalledOnce();
  });

  it('throws rate limit error when too many requests', async () => {
    mockRateLimiterCheck.mockResolvedValue({ allowed: false, remaining: 0 });
    const event = makeEvent(true);
    await expect(handler(event)).rejects.toThrow('RATE_LIMITED');
    expect(userService.register).not.toHaveBeenCalled();
  });
});
