import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

// ---------------------------------------------------------------------------
// A cookie jar on a fake event: `request` is what the browser sent, `response`
// records every Set-Cookie (null = deleted). Everything above h3 is real.
// ---------------------------------------------------------------------------
interface FakeEvent {
  context: Record<string, unknown>;
  request: Record<string, string | undefined>;
  response: Record<string, string | null>;
  /** maxAge of each Set-Cookie; undefined = a session cookie. */
  maxAge: Record<string, number | undefined>;
  /** Path of each delete; a browser only drops a cookie on the path it was set on. */
  deletedPath: Record<string, string | undefined>;
}

vi.stubGlobal(
  'getCookie',
  (event: FakeEvent, name: string) => event.request[name],
);
vi.stubGlobal(
  'setCookie',
  (
    event: FakeEvent,
    name: string,
    value: string,
    options: { maxAge?: number } = {},
  ) => {
    event.response[name] = value;
    event.maxAge[name] = options.maxAge;
  },
);
vi.stubGlobal(
  'deleteCookie',
  (event: FakeEvent, name: string, options: { path?: string } = {}) => {
    event.response[name] = null;
    event.deletedPath[name] = options.path;
  },
);

const cookies = await import('../../server/utils/cookies');
vi.stubGlobal('getAuthCookies', cookies.getAuthCookies);
vi.stubGlobal('setAuthCookies', cookies.setAuthCookies);
vi.stubGlobal('clearAuthCookies', cookies.clearAuthCookies);
vi.stubGlobal('getPreviewCookie', cookies.getPreviewCookie);

const errors = await import('../../server/utils/errors');
vi.stubGlobal('createAppError', errors.createAppError);
vi.stubGlobal('ErrorCode', errors.ErrorCode);
vi.stubGlobal('getRequestLocale', () => undefined);
vi.stubGlobal('getRequestMarket', () => undefined);
vi.stubGlobal('resolveTenant', vi.fn());

const refreshMock = vi.fn();
vi.mock('../../server/services/auth', () => ({
  refresh: (...args: unknown[]) => refreshMock(...args),
}));

const { requireAuth, optionalAuth, resolveSession, EXPIRES_SOON_SECONDS } =
  await import('../../server/utils/auth');
const { getSessionToken } = await import('../../server/utils/session');
vi.stubGlobal('getSessionToken', getSessionToken);
const { buildRequestContext } = await import('../../server/services/_sdk');
const { getRequestIdentity, hasUserToken, hashToken, ANONYMOUS_IDENTITY } =
  await import('../../server/utils/request-identity');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jwt(secondsLeft: number): string {
  const exp = Math.floor(Date.now() / 1000) + secondsLeft;
  const body = btoa(JSON.stringify({ exp })).replace(/=+$/, '');
  return `eyJhbGciOiJIUzI1NiJ9.${body}.sig`;
}

// Refresh tokens are unique per test so a rotation one test settles is never
// the grace entry another test reads.
let n = 0;
const nextRefresh = () => `refresh-${++n}`;

function makeEvent(request: FakeEvent['request']): H3Event & FakeEvent {
  return {
    context: { tenant: { hostname: 'shop.example' } },
    request,
    response: {},
    maxAge: {},
    deletedPath: {},
  } as unknown as H3Event & FakeEvent;
}

const ROTATED = jwt(900);
function rotation() {
  return {
    succeeded: true,
    user: { username: 'buyer@example.com' },
    tokens: { token: ROTATED, refreshToken: 'rotated-refresh', expiresIn: 900 },
  };
}

beforeEach(() => {
  refreshMock.mockReset();
});

// ---------------------------------------------------------------------------
// The defect: an expired auth cookie next to a valid refresh cookie
// ---------------------------------------------------------------------------

describe('a request carrying only the refresh cookie', () => {
  it('queries the Merchant API with the rotated token after optionalAuth', async () => {
    refreshMock.mockResolvedValue(rotation());
    const event = makeEvent({ refresh_token: nextRefresh() });

    await optionalAuth(event);

    expect(buildRequestContext(event)?.userToken).toBe(ROTATED);
  });

  it('keys the CMS cache on the buyer, not the anonymous marker', async () => {
    refreshMock.mockResolvedValue(rotation());
    const event = makeEvent({ refresh_token: nextRefresh() });

    await resolveSession(event);

    expect(getRequestIdentity(event)).toBe(hashToken(ROTATED));
    expect(getRequestIdentity(event)).not.toBe(ANONYMOUS_IDENTITY);
    expect(hasUserToken(event)).toBe(true);
  });

  it('sets the rotated pair on the response', async () => {
    refreshMock.mockResolvedValue(rotation());
    const event = makeEvent({ refresh_token: nextRefresh() });

    await resolveSession(event);

    expect(event.response).toEqual({
      auth_token: ROTATED,
      refresh_token: 'rotated-refresh',
    });
  });
});

// ---------------------------------------------------------------------------
// "Remember me": the choice made at sign-in outlives every rotation
// ---------------------------------------------------------------------------

describe('remember me', () => {
  it('keeps session cookies after a rotation when the buyer did not tick it', async () => {
    refreshMock.mockResolvedValue(rotation());
    const event = makeEvent({
      refresh_token: nextRefresh(),
      session_only: '1',
    });

    await resolveSession(event);

    expect(event.response.auth_token).toBe(ROTATED);
    expect(event.maxAge.auth_token).toBeUndefined();
    expect(event.maxAge.refresh_token).toBeUndefined();
  });

  it('keeps persistent cookies after a rotation by default', async () => {
    refreshMock.mockResolvedValue(rotation());
    const event = makeEvent({ refresh_token: nextRefresh() });

    await resolveSession(event);

    expect(event.maxAge.auth_token).toBe(900);
    expect(event.maxAge.refresh_token).toBe(30 * 24 * 60 * 60);
  });

  it('marks the session at sign-in without remember me, as a session cookie', () => {
    const event = makeEvent({});

    cookies.setAuthCookies(event, {
      token: 't',
      refreshToken: 'r',
      rememberMe: false,
    });

    expect(event.response.session_only).toBe('1');
    expect(event.maxAge.session_only).toBeUndefined();
    expect(event.maxAge.auth_token).toBeUndefined();
  });

  it('drops a mark left by an earlier sign-in when remember me is ticked', () => {
    const event = makeEvent({ session_only: '1' });

    cookies.setAuthCookies(event, {
      token: 't',
      refreshToken: 'r',
      rememberMe: true,
    });

    expect(event.response.session_only).toBeNull();
    expect(event.deletedPath.session_only).toBe('/');
    expect(event.maxAge.auth_token).toBe(3600);
  });

  it('deletes every auth cookie on the path it was set on', () => {
    const event = makeEvent({});

    cookies.clearAuthCookies(event);

    expect(event.deletedPath).toEqual({
      auth_token: '/',
      refresh_token: '/',
      session_only: '/',
    });
  });
});

describe('concurrent requests with the same stale refresh cookie', () => {
  it('rotate once and all stay signed in', async () => {
    refreshMock.mockResolvedValue(rotation());
    const refresh = nextRefresh();
    const events = [1, 2, 3].map(() => makeEvent({ refresh_token: refresh }));

    const states = await Promise.all(events.map((e) => resolveSession(e)));

    expect(refreshMock).toHaveBeenCalledTimes(1);
    for (const [i, state] of states.entries()) {
      expect(state?.status).toBe('active');
      expect(events[i]!.response.auth_token).toBe(ROTATED);
      expect(events[i]!.response.refresh_token).toBe('rotated-refresh');
    }
  });
});

// ---------------------------------------------------------------------------
// resolveSession: one decision per request
// ---------------------------------------------------------------------------

describe('resolveSession', () => {
  it('is anonymous without cookies', async () => {
    const event = makeEvent({});

    expect(await resolveSession(event)).toEqual({ status: 'anonymous' });
    expect(getSessionToken(event)).toBeUndefined();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('keeps a token with time left and does not refresh', async () => {
    const token = jwt(EXPIRES_SOON_SECONDS + 60);
    const refresh = nextRefresh();
    const event = makeEvent({ auth_token: token, refresh_token: refresh });

    const state = await resolveSession(event);

    expect(state).toEqual({
      status: 'active',
      tokens: { authToken: token, refreshToken: refresh },
    });
    expect(refreshMock).not.toHaveBeenCalled();
    expect(event.response).toEqual({});
  });

  it(`rotates a token with less than ${EXPIRES_SOON_SECONDS} s left`, async () => {
    refreshMock.mockResolvedValue(rotation());
    const event = makeEvent({
      auth_token: jwt(EXPIRES_SOON_SECONDS - 1),
      refresh_token: nextRefresh(),
    });

    const state = await resolveSession(event);

    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(getSessionToken(event)).toBe(ROTATED);
    expect(state?.status === 'active' && state.rotation).toEqual(rotation());
  });

  it(`does not rotate a token with ${EXPIRES_SOON_SECONDS} s left`, async () => {
    const event = makeEvent({
      auth_token: jwt(EXPIRES_SOON_SECONDS),
      refresh_token: nextRefresh(),
    });

    await resolveSession(event);

    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('never rotates a preview or impersonation token (no refresh cookie)', async () => {
    const token = jwt(10);
    const event = makeEvent({ auth_token: token });

    const state = await resolveSession(event);

    expect(state).toEqual({
      status: 'active',
      tokens: { authToken: token, refreshToken: '' },
    });
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('keeps a token it cannot read an expiry from', async () => {
    const event = makeEvent({
      auth_token: 'not-a-jwt',
      refresh_token: nextRefresh(),
    });

    await resolveSession(event);

    expect(getSessionToken(event)).toBe('not-a-jwt');
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('keeps a token that still works when an early rotation is refused, and touches no cookie', async () => {
    // A Geins hiccup, or a response the browser dropped, in the last 90 s must
    // not sign the buyer out; the request after the token runs out decides.
    refreshMock.mockResolvedValue({ succeeded: false });
    const token = jwt(30);
    const refresh = nextRefresh();
    const event = makeEvent({ auth_token: token, refresh_token: refresh });

    expect(await resolveSession(event)).toEqual({
      status: 'active',
      tokens: { authToken: token, refreshToken: refresh },
    });
    expect(event.response).toEqual({});
  });

  it('is expired, and clears the cookies, when Geins refuses and the token has run out', async () => {
    refreshMock.mockResolvedValue({ succeeded: false });
    const event = makeEvent({
      auth_token: jwt(-10),
      refresh_token: nextRefresh(),
    });

    expect(await resolveSession(event)).toEqual({ status: 'expired' });
    expect(event.response).toEqual({
      auth_token: null,
      refresh_token: null,
      session_only: null,
    });
    // The request cookie still holds the old token; an expired session must not read it.
    expect(getSessionToken(event)).toBeUndefined();
  });

  it('is expired when Geins refuses and the token ran out this very second', async () => {
    refreshMock.mockResolvedValue({ succeeded: false });
    const event = makeEvent({
      auth_token: jwt(0),
      refresh_token: nextRefresh(),
    });

    expect(await resolveSession(event)).toEqual({ status: 'expired' });
  });

  it('is expired when the refusal still carries a pair', async () => {
    refreshMock.mockResolvedValue({ ...rotation(), succeeded: false });
    const event = makeEvent({ refresh_token: nextRefresh() });

    expect(await resolveSession(event)).toEqual({ status: 'expired' });
  });

  it('is expired when the answer is empty', async () => {
    refreshMock.mockResolvedValue(undefined);
    const event = makeEvent({ refresh_token: nextRefresh() });

    expect(await resolveSession(event)).toEqual({ status: 'expired' });
  });

  it('is expired when a successful answer carries no tokens object', async () => {
    refreshMock.mockResolvedValue({ succeeded: true });
    const event = makeEvent({ refresh_token: nextRefresh() });

    expect(await resolveSession(event)).toEqual({ status: 'expired' });
  });

  it('is expired when a successful answer carries no tokens', async () => {
    refreshMock.mockResolvedValue({
      succeeded: true,
      tokens: { token: 'x', refreshToken: '' },
    });
    const event = makeEvent({ refresh_token: nextRefresh() });

    expect(await resolveSession(event)).toEqual({ status: 'expired' });
  });

  it('is not decided on an internal error: cookies stay, the request cookie is read', async () => {
    refreshMock.mockRejectedValue(
      new Error('Tenant has no Geins SDK configuration'),
    );
    const token = jwt(30);
    const event = makeEvent({
      auth_token: token,
      refresh_token: nextRefresh(),
    });

    expect(await resolveSession(event)).toBeUndefined();
    expect(event.response).toEqual({});
    expect(event.context.session).toBeUndefined();
    expect(getSessionToken(event)).toBe(token);
  });

  it('decides once per request', async () => {
    refreshMock.mockResolvedValue(rotation());
    const event = makeEvent({ refresh_token: nextRefresh() });

    await resolveSession(event);
    event.response = {};
    await resolveSession(event);
    await optionalAuth(event);
    await requireAuth(event);

    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(event.response).toEqual({});
  });
});

describe('getSessionToken', () => {
  it('reads the request cookie when nothing has decided the session', () => {
    const event = makeEvent({ auth_token: 'raw' });

    expect(getSessionToken(event)).toBe('raw');
  });

  it('reads nothing for an anonymous session', () => {
    const event = makeEvent({ auth_token: 'raw' });
    event.context.session = { status: 'anonymous' };

    expect(getSessionToken(event)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// requireAuth / optionalAuth keep the codes the client redirects on
// ---------------------------------------------------------------------------

describe('requireAuth', () => {
  it('throws SESSION_EXPIRED when Geins rejects the refresh', async () => {
    refreshMock.mockResolvedValue({ succeeded: false });
    const event = makeEvent({ refresh_token: nextRefresh() });

    await expect(requireAuth(event)).rejects.toMatchObject({
      statusCode: 401,
      data: { code: 'SESSION_EXPIRED' },
    });
  });

  it('throws UNAUTHORIZED without cookies', async () => {
    await expect(requireAuth(makeEvent({}))).rejects.toMatchObject({
      statusCode: 401,
      data: { code: 'UNAUTHORIZED' },
    });
  });

  it('throws UNAUTHORIZED, not SESSION_EXPIRED, on an internal error, and keeps the cookies', async () => {
    refreshMock.mockRejectedValue(new Error('network'));
    const event = makeEvent({ refresh_token: nextRefresh() });

    await expect(requireAuth(event)).rejects.toMatchObject({
      statusCode: 401,
      data: { code: 'UNAUTHORIZED' },
    });
    expect(event.response).toEqual({});
  });

  it('falls back to the request cookie on an internal error when a token is still there', async () => {
    refreshMock.mockRejectedValue(new Error('network'));
    const token = jwt(30);
    const refresh = nextRefresh();
    const event = makeEvent({ auth_token: token, refresh_token: refresh });

    await expect(requireAuth(event)).resolves.toEqual({
      authToken: token,
      refreshToken: refresh,
    });
  });
});

describe('optionalAuth', () => {
  it('returns null on an internal error and keeps the cookies', async () => {
    refreshMock.mockRejectedValue(new Error('network'));
    const event = makeEvent({ refresh_token: nextRefresh() });

    expect(await optionalAuth(event)).toBeNull();
    expect(event.response).toEqual({});
  });

  it('returns null for an expired session', async () => {
    refreshMock.mockResolvedValue({ succeeded: false });
    const event = makeEvent({ refresh_token: nextRefresh() });

    expect(await optionalAuth(event)).toBeNull();
  });
});
