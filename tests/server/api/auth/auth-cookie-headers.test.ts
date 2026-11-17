import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as h3 from 'h3';

/**
 * The Set-Cookie headers the auth routes send, as the browser receives them.
 *
 * h3's real cookie helpers run on a real event: `setCookie` keeps one header
 * per name and path and ignores `Partitioned`, so a delete that a later set
 * overwrites only shows up here, never with the helpers stubbed.
 */

let devMode = false;
vi.mock('../../../../server/utils/dev-mode', () => ({
  isDevMode: () => devMode,
}));

const mockLogin = vi.fn();
const mockLogout = vi.fn();
vi.mock('../../../../server/services/auth', () => ({
  login: (...args: unknown[]) => mockLogin(...args),
  logout: (...args: unknown[]) => mockLogout(...args),
}));

const mockRegister = vi.fn();
vi.mock('../../../../server/services/user', () => ({
  register: (...args: unknown[]) => mockRegister(...args),
}));

vi.mock('../../../../server/utils/rate-limiter', () => {
  const limiter = {
    check: async () => ({ allowed: true, remaining: 4, resetTime: 0 }),
    refund: async () => undefined,
  };
  return {
    loginRateLimiter: limiter,
    registerRateLimiter: limiter,
    getClientIp: () => '127.0.0.1',
  };
});

vi.mock('../../../../server/utils/sign-in-cart', () => ({
  settleSignInCart: async () => undefined,
}));

vi.mock('../../../../server/utils/buyer-market-resolver', () => ({
  resolveBuyerMarket: async () => null,
}));

vi.mock('../../../../server/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

for (const name of [
  'setCookie',
  'getCookie',
  'deleteCookie',
  'getQuery',
  'sendRedirect',
  'getResponseHeader',
  'setResponseHeader',
  'splitCookiesString',
] as const) {
  vi.stubGlobal(name, h3[name]);
}
const readValidatedBody = vi.fn();
vi.stubGlobal('readValidatedBody', readValidatedBody);
vi.stubGlobal('defineEventHandler', (fn: unknown) => fn);
vi.stubGlobal('createAppError', (code: string, message: string) => {
  return new Error(`${code}: ${message}`);
});
vi.stubGlobal('ErrorCode', {
  BAD_REQUEST: 'BAD_REQUEST',
  RATE_LIMITED: 'RATE_LIMITED',
  UNAUTHORIZED: 'UNAUTHORIZED',
});
vi.stubGlobal('getSessionToken', () => undefined);
// The preview landing reads Geins; its own tests cover it. Here it keeps the path.
vi.stubGlobal(
  'previewLandingPath',
  async (_event: unknown, _token: string, path: string) => path,
);

// Every cookie helper runs for real, as the Nitro auto-import would.
const cookies = await import('../../../../server/utils/cookies');
for (const [name, value] of Object.entries(cookies)) {
  vi.stubGlobal(name, value);
}

const logout = (await import('../../../../server/api/auth/logout.post'))
  .default;
const login = (await import('../../../../server/api/auth/login.post')).default;
const register = (await import('../../../../server/api/auth/register.post'))
  .default;
const loginAs = (await import('../../../../server/api/auth/login-as.get'))
  .default;
const previewEnter = (
  await import('../../../../server/api/auth/preview-enter.get')
).default;
const previewPost = (await import('../../../../server/api/auth/preview.post'))
  .default;
const previewExit = (
  await import('../../../../server/api/auth/preview-exit.post')
).default;

function eventFor(url = '/', cookie = ''): h3.H3Event {
  const req = new IncomingMessage(new Socket());
  req.url = url;
  req.headers.cookie = cookie;
  return h3.createEvent(req, new ServerResponse(req));
}

function setCookies(event: h3.H3Event): string[] {
  return h3.splitCookiesString(
    event.node.res.getHeader('set-cookie') as string | string[],
  );
}

function headersFor(event: h3.H3Event, name: string): string[] {
  return setCookies(event).filter((c) => c.startsWith(`${name}=`));
}

const PARTITIONED_DELETE =
  /^auth_token=; Max-Age=0; Path=\/; Secure; SameSite=None; Partitioned$/;
const isPartitioned = (c: string) => /; Partitioned\b/.test(c);

function jwt(payload: Record<string, unknown>): string {
  const part = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'HS256' })}.${part(payload)}.signature`;
}

const TOKENS = { token: 'new-token', refreshToken: 'new-refresh' };

beforeEach(() => {
  devMode = false;
  mockLogout.mockReset().mockResolvedValue(undefined);
  mockLogin.mockReset().mockResolvedValue({
    succeeded: true,
    tokens: { ...TOKENS, expiresIn: 900 },
    user: { username: 'buyer' },
  });
  mockRegister.mockReset().mockResolvedValue({
    succeeded: true,
    tokens: { ...TOKENS, expiresIn: 900 },
    user: { username: 'buyer' },
  });
});

describe('logout', () => {
  it('deletes auth_token both plain and partitioned, so a login-as token goes too', async () => {
    const event = eventFor('/api/auth/logout');
    await logout(event);

    const auth = headersFor(event, 'auth_token');
    expect(auth).toHaveLength(2);
    expect(auth.filter((c) => PARTITIONED_DELETE.test(c))).toHaveLength(1);
    expect(auth.filter((c) => !isPartitioned(c))).toEqual([
      'auth_token=; Max-Age=0; Path=/',
    ]);
  });

  it('ends the sign-in only and leaves a running preview', async () => {
    const event = eventFor(
      '/api/auth/logout',
      `${SIGNED_IN}; cms_preview_token=a.b.c; preview_mode=true`,
    );
    await logout(event);

    expect(headersFor(event, 'cms_preview_token')).toEqual([]);
    expect(headersFor(event, 'preview_mode')).toEqual([]);
  });

  it('sends no partitioned delete in dev, where nothing is partitioned', async () => {
    devMode = true;
    const event = eventFor('/api/auth/logout');
    await logout(event);

    expect(setCookies(event).filter(isPartitioned)).toEqual([]);
    expect(headersFor(event, 'auth_token')).toEqual([
      'auth_token=; Max-Age=0; Path=/',
    ]);
  });
});

describe.each([
  ['login', () => login, { username: 'b@x.se', password: 'pw' }],
  [
    'register',
    () => register,
    { username: 'b@x.se', password: 'pw', user: {} },
  ],
])('%s', (_name, handler, body) => {
  beforeEach(() => readValidatedBody.mockResolvedValue(body));

  it('deletes a leftover partitioned auth_token ahead of the new one', async () => {
    const event = eventFor('/api/auth/x', 'auth_token=old; geins-spoofed-by=a');
    await handler()(event);

    const all = setCookies(event);
    expect(all[0]).toMatch(PARTITIONED_DELETE);
    const auth = headersFor(event, 'auth_token');
    expect(auth).toHaveLength(2);
    expect(auth[1]).toMatch(/^auth_token=new-token; .*SameSite=Lax/);
    expect(isPartitioned(auth[1]!)).toBe(false);
    expect(headersFor(event, 'refresh_token')[0]).toMatch(
      /^refresh_token=new-refresh;/,
    );
  });

  it('deletes the impersonation banner cookie', async () => {
    const event = eventFor('/api/auth/x', 'geins-spoofed-by=a');
    await handler()(event);

    expect(headersFor(event, 'geins-spoofed-by')).toEqual([
      'geins-spoofed-by=; Max-Age=0; Path=/',
    ]);
  });

  it('sends no partitioned delete in dev', async () => {
    devMode = true;
    const event = eventFor('/api/auth/x');
    await handler()(event);

    expect(setCookies(event).filter(isPartitioned)).toEqual([]);
    expect(headersFor(event, 'auth_token')).toHaveLength(1);
  });
});

describe('login-as', () => {
  const token = jwt({ SpoofedBy: 'admin@example.com', exp: 9999999999 });
  const url = `/api/auth/login-as?loginToken=${token}`;

  it('stores the token unpartitioned and Lax for one hour', async () => {
    const event = eventFor(url);
    await loginAs(event);

    const set = headersFor(event, 'auth_token').filter((c) =>
      c.startsWith(`auth_token=${token}`),
    );
    expect(set).toHaveLength(1);
    expect(set[0]).toContain('Max-Age=3600');
    expect(set[0]).toContain('SameSite=Lax');
    expect(set[0]).toContain('HttpOnly');
    expect(isPartitioned(set[0]!)).toBe(false);
  });

  it("deletes the previous user's refresh token and session mark", async () => {
    const event = eventFor(url, 'refresh_token=r; session_only=1');
    await loginAs(event);

    expect(headersFor(event, 'refresh_token')).toContain(
      'refresh_token=; Max-Age=0; Path=/',
    );
    expect(headersFor(event, 'session_only')).toEqual([
      'session_only=; Max-Age=0; Path=/',
    ]);
  });

  it('deletes a partitioned token from an earlier release ahead of the new one', async () => {
    const event = eventFor(url);
    await loginAs(event);

    const auth = headersFor(event, 'auth_token');
    expect(auth).toHaveLength(2);
    expect(auth[0]).toMatch(PARTITIONED_DELETE);
    expect(auth[1]).toMatch(new RegExp(`^auth_token=${token};`));
  });

  it('still sets the impersonation banner cookie', async () => {
    const event = eventFor(url);
    await loginAs(event);

    expect(headersFor(event, 'geins-spoofed-by')[0]).toMatch(
      /^geins-spoofed-by=admin%40example\.com;/,
    );
  });
});

const SIGNED_IN =
  'auth_token=buyer; refresh_token=buyer-refresh; session_only=1';
const SIGN_IN_COOKIES = ['auth_token', 'refresh_token', 'session_only'];

describe.each([
  [
    'preview-enter',
    async () => {
      const event = eventFor(
        '/api/auth/preview-enter?loginToken=a.b.c',
        SIGNED_IN,
      );
      await previewEnter(event);
      return event;
    },
  ],
  [
    'preview (POST)',
    async () => {
      readValidatedBody.mockResolvedValue({ loginToken: 'a.b.c' });
      const event = eventFor('/api/auth/preview', SIGNED_IN);
      await previewPost(event);
      return event;
    },
  ],
])('%s', (_name, enter: () => Promise<h3.H3Event>) => {
  it('stores the preview token in its own partitioned cookie', async () => {
    const event = await enter();

    expect(headersFor(event, 'cms_preview_token')).toEqual([
      expect.stringMatching(
        /^cms_preview_token=a\.b\.c; Max-Age=3600; .*HttpOnly.*Partitioned/,
      ),
    ]);
    expect(headersFor(event, 'preview_mode')).toEqual([
      expect.stringMatching(/^preview_mode=true; .*Partitioned/),
    ]);
  });

  it("leaves a signed-in buyer's cookies alone", async () => {
    const event = await enter();

    for (const name of SIGN_IN_COOKIES) {
      expect(headersFor(event, name)).toEqual([]);
    }
  });

  it('in dev, sets the preview cookies unpartitioned and nothing else', async () => {
    devMode = true;
    const event = await enter();

    expect(setCookies(event).filter(isPartitioned)).toEqual([]);
    expect(headersFor(event, 'cms_preview_token')).toHaveLength(1);
    for (const name of SIGN_IN_COOKIES) {
      expect(headersFor(event, name)).toEqual([]);
    }
  });
});

describe('preview-exit', () => {
  it('deletes only the preview cookies, with the attributes they were set with', async () => {
    const event = eventFor('/api/auth/preview-exit', SIGNED_IN);
    await previewExit(event);

    expect(setCookies(event)).toEqual([
      'cms_preview_token=; Max-Age=0; Path=/; Secure; SameSite=None; Partitioned',
      'preview_mode=; Max-Age=0; Path=/; Secure; SameSite=None; Partitioned',
    ]);
  });

  it('in dev, deletes the preview cookies unpartitioned', async () => {
    devMode = true;
    const event = eventFor('/api/auth/preview-exit', SIGNED_IN);
    await previewExit(event);

    expect(setCookies(event)).toEqual([
      'cms_preview_token=; Max-Age=0; Path=/; SameSite=Lax',
      'preview_mode=; Max-Age=0; Path=/; SameSite=Lax',
    ]);
  });
});

describe('expirePartitionedAuthToken', () => {
  it('keeps a single earlier Set-Cookie behind the delete', () => {
    const event = eventFor();
    h3.setCookie(event, 'market', 'se', { path: '/' });
    cookies.expirePartitionedAuthToken(event);

    expect(setCookies(event)).toEqual([
      expect.stringMatching(PARTITIONED_DELETE),
      'market=se; Path=/',
    ]);
  });

  it('sends only the delete when the response sets nothing else', () => {
    const event = eventFor();
    cookies.expirePartitionedAuthToken(event);

    expect(setCookies(event)).toEqual([
      expect.stringMatching(PARTITIONED_DELETE),
    ]);
  });
});
