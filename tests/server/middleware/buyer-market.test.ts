import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { H3Event } from 'h3';

// Mock Nitro auto-imports used by the middleware.
const getCookieMock = vi.fn();
const getHeaderMock = vi.fn();
const sendRedirectMock = vi.fn();

vi.stubGlobal('getCookie', getCookieMock);
vi.stubGlobal('getHeader', getHeaderMock);
vi.stubGlobal('sendRedirect', sendRedirectMock);
vi.stubGlobal('defineEventHandler', (fn: (e: H3Event) => unknown) => fn);

// Mock the load-user helper so tests never touch the Geins SDK.
const loadUserMock = vi.fn();
vi.mock('../../../server/utils/load-user', () => ({
  loadUserForToken: loadUserMock,
}));

vi.mock('#shared/constants/storage', () => ({
  COOKIE_NAMES: {
    AUTH_TOKEN: 'auth_token',
    REFRESH_TOKEN: 'refresh_token',
    TENANT_ID: 'tenant_id',
    LOCALE: 'locale',
    MARKET: 'market',
    CART_ID: 'cart_id',
    PREVIEW_MODE: 'preview_mode',
    SPOOFED_BY: 'geins-spoofed-by',
  },
}));

interface EventOpts {
  path?: string;
  accept?: string | null;
  authCookie?: string | null;
  tenantId?: string;
  channel?: string;
  tld?: string;
  localeMarket?: { market: string; locale: string } | null;
}

function makeEvent(opts: EventOpts = {}): H3Event {
  const cookies: Record<string, string | undefined> = {
    auth_token: opts.authCookie ?? undefined,
  };
  const headers: Record<string, string | undefined> = {
    accept: opts.accept === null ? undefined : (opts.accept ?? 'text/html'),
  };
  getCookieMock.mockImplementation(
    (_event: unknown, name: string) => cookies[name],
  );
  getHeaderMock.mockImplementation(
    (_event: unknown, name: string) => headers[name.toLowerCase()],
  );
  return {
    path: opts.path ?? '/se/sv/portal',
    context: {
      tenant:
        opts.tenantId === undefined &&
        opts.channel === undefined &&
        opts.tld === undefined
          ? {
              id: 'tenantA',
              config: {
                geinsSettings: { channel: '1', tld: 'se' },
              },
            }
          : {
              id: opts.tenantId ?? 'tenantA',
              config: {
                geinsSettings: {
                  channel: opts.channel ?? '1',
                  tld: opts.tld ?? 'se',
                },
              },
            },
      localeMarket:
        opts.localeMarket === null
          ? undefined
          : (opts.localeMarket ?? { market: 'se', locale: 'sv' }),
    },
  } as unknown as H3Event;
}

function makeUser(aliases: string[], channelId = '1|se') {
  return {
    availableChannels: [
      {
        channelId,
        availableMarkets: aliases.map((alias) => ({ alias })),
      },
    ],
  };
}

async function importHandler() {
  const mod = await import('../../../server/middleware/01.buyer-market');
  return mod.default as (event: H3Event) => Promise<unknown>;
}

describe('server/middleware/01.buyer-market', () => {
  beforeEach(() => {
    vi.resetModules();
    getCookieMock.mockReset();
    getHeaderMock.mockReset();
    sendRedirectMock.mockReset();
    loadUserMock.mockReset();
    sendRedirectMock.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('a) skips when no auth cookie', async () => {
    const handler = await importHandler();
    const event = makeEvent({ authCookie: null });
    await handler(event);
    expect(loadUserMock).not.toHaveBeenCalled();
    expect(sendRedirectMock).not.toHaveBeenCalled();
  });

  it('b) skips API paths', async () => {
    const handler = await importHandler();
    const event = makeEvent({
      path: '/api/foo',
      authCookie: 'tok',
    });
    await handler(event);
    expect(loadUserMock).not.toHaveBeenCalled();
    expect(sendRedirectMock).not.toHaveBeenCalled();
  });

  it('c) skips asset paths (favicon, _nuxt, dotted)', async () => {
    const handler = await importHandler();
    for (const path of [
      '/_nuxt/x.js',
      '/favicon.ico',
      '/robots.txt',
      '/sitemap.xml',
      '/healthz',
      '/__nuxt_loading',
    ]) {
      sendRedirectMock.mockClear();
      loadUserMock.mockClear();
      await handler(makeEvent({ path, authCookie: 'tok' }));
      expect(loadUserMock).not.toHaveBeenCalled();
      expect(sendRedirectMock).not.toHaveBeenCalled();
    }
  });

  it('d) skips when accept lacks text/html', async () => {
    const handler = await importHandler();
    const event = makeEvent({
      authCookie: 'tok',
      accept: 'application/json',
    });
    await handler(event);
    expect(loadUserMock).not.toHaveBeenCalled();
    expect(sendRedirectMock).not.toHaveBeenCalled();
  });

  it('e) no redirect when URL market is allowed', async () => {
    loadUserMock.mockResolvedValue(makeUser(['se']));
    const handler = await importHandler();
    const event = makeEvent({
      authCookie: 'tok',
      localeMarket: { market: 'se', locale: 'sv' },
    });
    await handler(event);
    expect(sendRedirectMock).not.toHaveBeenCalled();
  });

  it('f) redirects to allowed market preserving rest path', async () => {
    loadUserMock.mockResolvedValue(makeUser(['se']));
    const handler = await importHandler();
    const event = makeEvent({
      authCookie: 'tok',
      path: '/no/sv/portal',
      localeMarket: { market: 'no', locale: 'sv' },
    });
    await handler(event);
    expect(sendRedirectMock).toHaveBeenCalledWith(event, '/se/sv/portal', 302);
  });

  it('g) preserves deeper rest path segments', async () => {
    loadUserMock.mockResolvedValue(makeUser(['fi', 'se']));
    const handler = await importHandler();
    const event = makeEvent({
      authCookie: 'tok',
      path: '/no/sv/c/foo/bar',
      localeMarket: { market: 'no', locale: 'sv' },
    });
    await handler(event);
    expect(sendRedirectMock).toHaveBeenCalledWith(
      event,
      '/fi/sv/c/foo/bar',
      302,
    );
  });

  it('h) fail-open: lookup error means no redirect', async () => {
    loadUserMock.mockRejectedValue(new Error('boom'));
    const handler = await importHandler();
    const event = makeEvent({
      authCookie: 'tok',
      path: '/no/sv/portal',
      localeMarket: { market: 'no', locale: 'sv' },
    });
    await handler(event);
    expect(sendRedirectMock).not.toHaveBeenCalled();
  });

  it('i) cache hit: second request does not call loadUserForToken', async () => {
    loadUserMock.mockResolvedValue(makeUser(['se']));
    const handler = await importHandler();
    await handler(
      makeEvent({
        authCookie: 'tok-cache',
        path: '/no/sv/portal',
        localeMarket: { market: 'no', locale: 'sv' },
      }),
    );
    await handler(
      makeEvent({
        authCookie: 'tok-cache',
        path: '/no/sv/other',
        localeMarket: { market: 'no', locale: 'sv' },
      }),
    );
    expect(loadUserMock).toHaveBeenCalledTimes(1);
    expect(sendRedirectMock).toHaveBeenCalledTimes(2);
  });

  it('j) cache TTL: re-invokes lookup after expiry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-22T00:00:00Z'));
    loadUserMock.mockResolvedValue(makeUser(['se']));
    const handler = await importHandler();
    await handler(
      makeEvent({
        authCookie: 'tok-ttl',
        path: '/no/sv/portal',
        localeMarket: { market: 'no', locale: 'sv' },
      }),
    );
    expect(loadUserMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(31_000);

    await handler(
      makeEvent({
        authCookie: 'tok-ttl',
        path: '/no/sv/portal',
        localeMarket: { market: 'no', locale: 'sv' },
      }),
    );
    expect(loadUserMock).toHaveBeenCalledTimes(2);
  });

  it('k) multi-tenant isolation: same token, different tenant means separate lookup', async () => {
    loadUserMock.mockResolvedValue(makeUser(['se']));
    const handler = await importHandler();
    await handler(
      makeEvent({
        authCookie: 'shared-tok',
        tenantId: 'tenantA',
        path: '/no/sv/portal',
        localeMarket: { market: 'no', locale: 'sv' },
      }),
    );
    await handler(
      makeEvent({
        authCookie: 'shared-tok',
        tenantId: 'tenantB',
        path: '/no/sv/portal',
        localeMarket: { market: 'no', locale: 'sv' },
      }),
    );
    expect(loadUserMock).toHaveBeenCalledTimes(2);
  });

  it('l) LRU cap: 5001st insertion evicts the first entry', async () => {
    loadUserMock.mockResolvedValue(makeUser(['se']));
    const handler = await importHandler();
    // 5001 distinct tokens force eviction of first entry.
    for (let i = 0; i < 5001; i++) {
      await handler(
        makeEvent({
          authCookie: `tok-${i}`,
          path: '/no/sv/portal',
          localeMarket: { market: 'no', locale: 'sv' },
        }),
      );
    }
    expect(loadUserMock).toHaveBeenCalledTimes(5001);

    // Re-request the first key, which should now be a cache miss (evicted).
    loadUserMock.mockClear();
    await handler(
      makeEvent({
        authCookie: 'tok-0',
        path: '/no/sv/portal',
        localeMarket: { market: 'no', locale: 'sv' },
      }),
    );
    expect(loadUserMock).toHaveBeenCalledTimes(1);
  });

  it('skips when localeMarket context is missing (unprefixed)', async () => {
    const handler = await importHandler();
    const event = makeEvent({
      authCookie: 'tok',
      path: '/',
      localeMarket: null,
    });
    await handler(event);
    expect(loadUserMock).not.toHaveBeenCalled();
    expect(sendRedirectMock).not.toHaveBeenCalled();
  });
});
