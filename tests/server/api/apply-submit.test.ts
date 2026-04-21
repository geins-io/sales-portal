import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

// Logger captured via the global stub below — check calls after the handler runs.
// vi.hoisted() so the reference is available inside the top-level vi.mock factory.
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('#imports', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, logger: mockLogger };
});

const mockRateLimiterCheck = vi.fn();
const mockSetAuthCookies = vi.fn();

// Mock the user service — register + updateUser
const { mockRegister, mockUpdateUser } = vi.hoisted(() => ({
  mockRegister: vi.fn(),
  mockUpdateUser: vi.fn(),
}));
vi.mock('../../../server/services/user', () => ({
  register: mockRegister,
  updateUser: mockUpdateUser,
}));

// Stub Nitro auto-imports
vi.stubGlobal('getClientIp', vi.fn().mockReturnValue('127.0.0.1'));
vi.stubGlobal('applyForAccountRateLimiter', { check: mockRateLimiterCheck });
vi.stubGlobal('setAuthCookies', mockSetAuthCookies);
vi.stubGlobal('logger', mockLogger);
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
  BAD_REQUEST: 'BAD_REQUEST',
});

let capturedBody: Record<string, unknown> = {};
vi.stubGlobal(
  'readValidatedBody',
  vi.fn(async (_event: H3Event, parse: (data: unknown) => unknown) => {
    return parse(capturedBody);
  }),
);

vi.stubGlobal('defineEventHandler', (fn: (event: H3Event) => unknown) => fn);

const validBody = {
  companyName: 'Acme Corp',
  organizationNumber: '556677-8899',
  firstName: 'Jane',
  lastName: 'Doe',
  country: 'SE',
  email: 'jane@acme.com',
  password: 'secret123',
  acceptTerms: true,
  phone: '+46701234567',
  message: 'We want a wholesale account.',
};

const registerSuccess = {
  succeeded: true,
  tokens: {
    token: 'access-token',
    refreshToken: 'refresh-token',
    expiresIn: 3600,
  },
  user: { id: 42, email: 'jane@acme.com', customerType: 'PERSON' },
};

const updatedUser = {
  id: 42,
  email: 'jane@acme.com',
  customerType: 'ORGANIZATION',
};

const mockEvent = {
  node: { req: { headers: {}, socket: { remoteAddress: '127.0.0.1' } } },
} as unknown as H3Event;

describe('POST /api/apply/submit', () => {
  let handler: (event: H3Event) => Promise<unknown>;

  beforeEach(async () => {
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    mockLogger.debug.mockClear();
    mockRateLimiterCheck.mockReset();
    mockRegister.mockReset();
    mockUpdateUser.mockReset();
    mockSetAuthCookies.mockClear();
    capturedBody = { ...validBody };
    mockRateLimiterCheck.mockResolvedValue({ allowed: true, remaining: 2 });
    mockRegister.mockResolvedValue(registerSuccess);
    mockUpdateUser.mockResolvedValue(updatedUser);

    if (!handler) {
      const mod = await import('../../../server/api/apply/submit.post');
      handler = mod.default as (event: H3Event) => Promise<unknown>;
    }
  });

  it('registers the user, promotes to ORGANIZATION, sets cookies and returns user', async () => {
    const result = (await handler(mockEvent)) as {
      user: unknown;
      expiresAt: string | null;
    };

    expect(mockRegister).toHaveBeenCalledWith(
      { username: validBody.email, password: validBody.password },
      expect.objectContaining({
        address: expect.objectContaining({
          firstName: 'Jane',
          lastName: 'Doe',
          company: 'Acme Corp',
          country: 'SE',
        }),
      }),
      mockEvent,
    );

    expect(mockUpdateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        customerType: 'ORGANIZATION',
        address: expect.objectContaining({ company: 'Acme Corp' }),
      }),
      'access-token',
      mockEvent,
    );

    expect(mockSetAuthCookies).toHaveBeenCalledWith(mockEvent, {
      token: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
    });

    expect(result.user).toEqual(updatedUser);
    expect(result.expiresAt).toBeTruthy();
  });

  it('throws BAD_REQUEST and skips updateUser when register fails', async () => {
    mockRegister.mockResolvedValue({ succeeded: false });

    await expect(handler(mockEvent)).rejects.toThrow('BAD_REQUEST');
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(mockSetAuthCookies).not.toHaveBeenCalled();
  });

  it('throws BAD_REQUEST when register returns no tokens', async () => {
    mockRegister.mockResolvedValue({ succeeded: true, tokens: null });

    await expect(handler(mockEvent)).rejects.toThrow('BAD_REQUEST');
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(mockSetAuthCookies).not.toHaveBeenCalled();
  });

  it('throws BAD_REQUEST when updateUser fails after register', async () => {
    mockUpdateUser.mockRejectedValue(new Error('SDK blew up'));

    // User is already registered as PERSON at this point; the endpoint
    // throws to signal the caller to retry, and sales team recovers
    // manually in Studio using the logged organizationNumber. The logger
    // is auto-imported so we verify the failure signal (rejected promise
    // with BAD_REQUEST) rather than asserting on the logger mock itself.
    await expect(handler(mockEvent)).rejects.toThrow('BAD_REQUEST');
    expect(mockSetAuthCookies).not.toHaveBeenCalled();
  });

  it('throws rate limit error when too many requests', async () => {
    mockRateLimiterCheck.mockResolvedValue({ allowed: false, remaining: 0 });

    await expect(handler(mockEvent)).rejects.toThrow('RATE_LIMITED');
    expect(mockRegister).not.toHaveBeenCalled();
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
    expect(mockRegister).not.toHaveBeenCalled();
  });
});
