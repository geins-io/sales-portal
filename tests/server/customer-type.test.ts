import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';
import { GeinsCustomerType } from '@geins/types';

// Helper to create a JWT with a given payload
function createJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  const signature = 'fake-signature';
  return `${header}.${body}.${signature}`;
}

// Stub Nitro auto-imports that optionalAuth depends on
const getAuthCookiesMock = vi.fn();
const getPreviewCookieMock = vi.fn().mockReturnValue(false);
const clearAuthCookiesMock = vi.fn();

vi.stubGlobal('getAuthCookies', getAuthCookiesMock);
vi.stubGlobal('getPreviewCookie', getPreviewCookieMock);
vi.stubGlobal('clearAuthCookies', clearAuthCookiesMock);
vi.stubGlobal(
  'createAppError',
  vi.fn((code: string, msg: string) => new Error(`${code}: ${msg}`)),
);

// Stub ErrorCode enum
vi.stubGlobal('ErrorCode', { UNAUTHORIZED: 'UNAUTHORIZED' });

// Mock auth service (external dependency)
vi.mock('../../server/services/auth', () => ({
  refresh: vi.fn(),
}));

const { getCustomerType } = await import('../../server/utils/auth');

const mockEvent = {} as H3Event;

describe('getCustomerType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPreviewCookieMock.mockReturnValue(false);
  });

  it('returns PersonType when JWT contains customerType PERSON', async () => {
    const token = createJwt({ customerType: 'PERSON', sub: '123' });
    getAuthCookiesMock.mockReturnValue({
      authToken: token,
      refreshToken: 'rt',
    });

    const result = await getCustomerType(mockEvent);

    expect(result).toBe(GeinsCustomerType.PersonType);
  });

  it('returns OrganizationType when JWT contains customerType ORGANIZATION', async () => {
    const token = createJwt({ customerType: 'ORGANIZATION', sub: '456' });
    getAuthCookiesMock.mockReturnValue({
      authToken: token,
      refreshToken: 'rt',
    });

    const result = await getCustomerType(mockEvent);

    expect(result).toBe(GeinsCustomerType.OrganizationType);
  });

  it('returns undefined when not authenticated', async () => {
    getAuthCookiesMock.mockReturnValue({
      authToken: undefined,
      refreshToken: undefined,
    });

    const result = await getCustomerType(mockEvent);

    expect(result).toBeUndefined();
  });

  it('returns undefined when JWT payload has no customerType field', async () => {
    const token = createJwt({ sub: '789' });
    getAuthCookiesMock.mockReturnValue({
      authToken: token,
      refreshToken: 'rt',
    });

    const result = await getCustomerType(mockEvent);

    expect(result).toBeUndefined();
  });

  it('returns undefined when JWT payload has invalid customerType', async () => {
    const token = createJwt({ customerType: 'INVALID', sub: '000' });
    getAuthCookiesMock.mockReturnValue({
      authToken: token,
      refreshToken: 'rt',
    });

    const result = await getCustomerType(mockEvent);

    expect(result).toBeUndefined();
  });

  it('returns undefined when auth token is malformed', async () => {
    getAuthCookiesMock.mockReturnValue({
      authToken: 'not-a-valid-jwt',
      refreshToken: 'rt',
    });

    const result = await getCustomerType(mockEvent);

    expect(result).toBeUndefined();
  });

  it('returns undefined when preview cookie is set even if authenticated', async () => {
    getPreviewCookieMock.mockReturnValue(true);
    const token = createJwt({ customerType: 'PERSON', sub: '123' });
    getAuthCookiesMock.mockReturnValue({
      authToken: token,
      refreshToken: 'rt',
    });

    const result = await getCustomerType(mockEvent);

    expect(result).toBeUndefined();
    expect(getAuthCookiesMock).not.toHaveBeenCalled();
  });

  it('handles lowercase customerType by uppercasing before comparison', async () => {
    const token = createJwt({ customerType: 'person', sub: '123' });
    getAuthCookiesMock.mockReturnValue({
      authToken: token,
      refreshToken: 'rt',
    });

    const result = await getCustomerType(mockEvent);

    expect(result).toBe(GeinsCustomerType.PersonType);
  });
});
