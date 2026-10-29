import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

const deleteCookie = vi.fn();
vi.stubGlobal('deleteCookie', deleteCookie);
vi.stubGlobal('setCookie', vi.fn());
vi.stubGlobal('getCookie', vi.fn());
vi.stubGlobal(
  'defineEventHandler',
  (fn: (...args: unknown[]) => unknown) => fn,
);

const mockLogout = vi.fn();
vi.mock('../../../../server/services/auth', () => ({
  logout: (...args: unknown[]) => mockLogout(...args),
}));

// The cookie helpers run for real, so the test sees which cookies go.
const cookies = await import('../../../../server/utils/cookies');
vi.stubGlobal('clearAuthCookies', cookies.clearAuthCookies);
vi.stubGlobal('clearSpoofedByCookie', cookies.clearSpoofedByCookie);
vi.stubGlobal('clearPreviewCookie', cookies.clearPreviewCookie);
vi.stubGlobal('clearCartCookie', cookies.clearCartCookie);

const handler = (await import('../../../../server/api/auth/logout.post'))
  .default;

const EVENT = {} as H3Event;

function deleted(): string[] {
  return deleteCookie.mock.calls.map((call) => call[1] as string);
}

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    deleteCookie.mockClear();
    mockLogout.mockReset().mockResolvedValue(undefined);
  });

  it("drops the buyer's cart from the browser, so the next buyer never gets it", async () => {
    await handler(EVENT);

    expect(deleteCookie).toHaveBeenCalledWith(EVENT, 'cart_id', { path: '/' });
  });

  it('keeps the owner note, so the buyer gets their cart back at the next sign-in', async () => {
    await handler(EVENT);

    expect(deleted()).not.toContain('cart_owner');
  });

  it('clears the session cookies as before', async () => {
    await handler(EVENT);

    expect(deleted()).toEqual(
      expect.arrayContaining(['auth_token', 'refresh_token', 'session_only']),
    );
  });

  it('drops the cart even when the sign-out call to Geins fails', async () => {
    mockLogout.mockRejectedValue(new Error('upstream down'));

    await expect(handler(EVENT)).resolves.toEqual({ success: true });
    expect(deleted()).toContain('cart_id');
  });
});
