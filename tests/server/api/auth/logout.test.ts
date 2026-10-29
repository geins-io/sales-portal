import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

// The request's cookies; a delete removes the cookie from the jar, as the
// browser does once the response arrives.
const jar = new Map<string, string>();
const deleteCookie = vi.fn((_event: H3Event, name: string) => {
  jar.delete(name);
});
vi.stubGlobal('deleteCookie', deleteCookie);
vi.stubGlobal('setCookie', (_event: H3Event, name: string, value: string) => {
  jar.set(name, value);
});
vi.stubGlobal('getCookie', (_event: H3Event, name: string) => jar.get(name));
vi.stubGlobal(
  'defineEventHandler',
  (fn: (...args: unknown[]) => unknown) => fn,
);

const mockLogout = vi.fn();
vi.mock('../../../../server/services/auth', () => ({
  logout: (...args: unknown[]) => mockLogout(...args),
}));

// The cookie helpers and the session lookup run for real, so the test sees
// which cookies go and which token the route reads.
const cookies = await import('../../../../server/utils/cookies');
const { getSessionToken } = await import('../../../../server/utils/session');
vi.stubGlobal('clearAuthCookies', cookies.clearAuthCookies);
vi.stubGlobal('clearSpoofedByCookie', cookies.clearSpoofedByCookie);
vi.stubGlobal('clearPreviewCookie', cookies.clearPreviewCookie);
vi.stubGlobal('clearCartCookie', cookies.clearCartCookie);
vi.stubGlobal('getCartCookie', cookies.getCartCookie);
vi.stubGlobal('getSessionToken', getSessionToken);

const handler = (await import('../../../../server/api/auth/logout.post'))
  .default;

/** The session middleware skips this route, so the event carries no session. */
const EVENT = { context: {} } as H3Event;

const SID_CLAIM = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/sid';
const A = 'buyer-a';
const B = 'buyer-b';

/** A sign-in token as Geins issues it, expired: it still names the buyer. */
function tokenFor(sid: string): string {
  const part = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'HS256' })}.${part({ [SID_CLAIM]: sid, MemberId: '2', exp: 1 })}.signature`;
}

function deleted(): string[] {
  return deleteCookie.mock.calls.map((call) => call[1] as string);
}

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    jar.clear();
    deleteCookie.mockClear();
    mockLogout.mockReset().mockResolvedValue(undefined);
  });

  it("drops the buyer's cart from the browser, so the next buyer never gets it", async () => {
    jar.set('cart_id', 'cart-a');

    await handler(EVENT);

    expect(deleteCookie).toHaveBeenCalledWith(EVENT, 'cart_id', { path: '/' });
  });

  it('notes the cart for the buyer signing out, so the next sign-in gives it back', async () => {
    jar.set('auth_token', tokenFor(A));
    jar.set('cart_id', 'cart-a');

    await handler(EVENT);

    expect(jar.get('cart_owner')).toBe(`${A}|cart-a`);
    expect(jar.has('cart_id')).toBe(false);
  });

  it("moves the buyer's own entry to the front", async () => {
    jar.set('auth_token', tokenFor(A));
    jar.set('cart_id', 'cart-a');
    jar.set('cart_owner', `${B}|cart-b,${A}|cart-a`);

    await handler(EVENT);

    expect(jar.get('cart_owner')).toBe(`${A}|cart-a,${B}|cart-b`);
  });

  it('leaves a cart noted for another buyer as it is, and still drops it from the browser', async () => {
    jar.set('auth_token', tokenFor(A));
    jar.set('cart_id', 'cart-b');
    jar.set('cart_owner', `${B}|cart-b`);

    await handler(EVENT);

    expect(jar.get('cart_owner')).toBe(`${B}|cart-b`);
    expect(jar.has('cart_id')).toBe(false);
  });

  it('notes nothing without a token, and still drops the cart', async () => {
    jar.set('cart_id', 'cart-a');

    await handler(EVENT);

    expect(jar.has('cart_owner')).toBe(false);
    expect(jar.has('cart_id')).toBe(false);
  });

  it('notes nothing for a token without a buyer id, and still drops the cart', async () => {
    jar.set('auth_token', 'not-a-token');
    jar.set('cart_id', 'cart-a');

    await handler(EVENT);

    expect(jar.has('cart_owner')).toBe(false);
    expect(jar.has('cart_id')).toBe(false);
  });

  it('notes nothing when the browser has no cart', async () => {
    jar.set('auth_token', tokenFor(A));

    await handler(EVENT);

    expect(jar.has('cart_owner')).toBe(false);
  });

  it('clears the session cookies as before', async () => {
    await handler(EVENT);

    expect(deleted()).toEqual(
      expect.arrayContaining(['auth_token', 'refresh_token', 'session_only']),
    );
  });

  it('drops the cart even when the sign-out call to Geins fails', async () => {
    jar.set('auth_token', tokenFor(A));
    jar.set('cart_id', 'cart-a');
    mockLogout.mockRejectedValue(new Error('upstream down'));

    await expect(handler(EVENT)).resolves.toEqual({ success: true });
    expect(jar.has('cart_id')).toBe(false);
    expect(jar.get('cart_owner')).toBe(`${A}|cart-a`);
  });
});
