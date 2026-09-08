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

/** Signs the caller in with a token carrying the given claims. */
function signedInWith(payload: Record<string, unknown>): void {
  getAuthCookiesMock.mockReturnValue({
    authToken: createJwt(payload),
    refreshToken: 'rt',
  });
}

describe('getCustomerType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPreviewCookieMock.mockReturnValue(false);
  });

  it('maps CustomerType "1" to PersonType', async () => {
    signedInWith({ CustomerType: '1', MemberId: '2' });

    const result = await getCustomerType(mockEvent);

    expect(result).toBe(GeinsCustomerType.PersonType);
  });

  it('maps CustomerType "2" to OrganizationType', async () => {
    signedInWith({ CustomerType: '2', MemberId: '2' });

    const result = await getCustomerType(mockEvent);

    expect(result).toBe(GeinsCustomerType.OrganizationType);
  });

  it('maps a numeric CustomerType claim the same way as its string form', async () => {
    signedInWith({ CustomerType: 1 });

    const result = await getCustomerType(mockEvent);

    expect(result).toBe(GeinsCustomerType.PersonType);
  });

  it('returns undefined for CustomerType "0", which the platform treats as unset', async () => {
    signedInWith({ CustomerType: '0' });

    const result = await getCustomerType(mockEvent);

    expect(result).toBeUndefined();
  });

  it('returns undefined when the CustomerType claim is absent', async () => {
    signedInWith({ sub: '789' });

    const result = await getCustomerType(mockEvent);

    expect(result).toBeUndefined();
  });

  it('returns undefined for a CustomerType value outside the numeric domain', async () => {
    signedInWith({ CustomerType: 'ORGANIZATION' });

    const result = await getCustomerType(mockEvent);

    expect(result).toBeUndefined();
  });

  it('returns undefined for the SDK user-object shape, which the raw token never carries', async () => {
    // @geins/crm flattens the claim to a lowercase `customerType` on its own
    // user object. Reading that key off the token was the defect.
    signedInWith({ customerType: 'PERSON' });

    const result = await getCustomerType(mockEvent);

    expect(result).toBeUndefined();
  });

  it('returns undefined when not authenticated', async () => {
    getAuthCookiesMock.mockReturnValue({
      authToken: undefined,
      refreshToken: undefined,
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
    signedInWith({ CustomerType: '2' });

    const result = await getCustomerType(mockEvent);

    expect(result).toBeUndefined();
    expect(getAuthCookiesMock).not.toHaveBeenCalled();
  });
});
