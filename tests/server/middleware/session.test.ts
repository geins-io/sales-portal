import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

vi.stubGlobal('defineEventHandler', (fn: (e: H3Event) => unknown) => fn);

const resolveSessionMock = vi.fn();
vi.mock('../../../server/utils/auth', () => ({
  resolveSession: (...args: unknown[]) => resolveSessionMock(...args),
}));

const middleware = (await import('../../../server/middleware/00.session'))
  .default as unknown as (event: H3Event) => Promise<unknown>;

function run(path: string, context: Record<string, unknown> = {}) {
  const event = {
    path,
    context: { tenant: { hostname: 'shop.example' }, ...context },
  } as unknown as H3Event;
  return middleware(event).then(() => event);
}

beforeEach(() => {
  resolveSessionMock.mockReset();
  resolveSessionMock.mockResolvedValue({ status: 'anonymous' });
});

describe('00.session middleware', () => {
  it.each([
    '/api/cart/items',
    '/api/cms/area?family=Frontpage',
    '/api/orders',
    '/se/sv',
    '/se/sv/portal/orders',
    '/',
  ])('resolves the session for %s', async (path) => {
    const event = await run(path);

    expect(resolveSessionMock).toHaveBeenCalledWith(event);
  });

  it.each([
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/refresh',
    '/api/auth/register',
    '/api/auth/login-as?token=x',
    '/api/auth/preview-enter',
    '/api/internal/config-refresh',
    '/api/health',
    '/api/health/ready',
    '/_nuxt/entry.js',
    '/__nuxt_error',
    '/favicon.ico',
    '/robots.txt',
    '/_ipx/w_200/image.jpg',
  ])('leaves %s alone', async (path) => {
    await run(path);

    expect(resolveSessionMock).not.toHaveBeenCalled();
  });

  it('leaves a request the tenant plugin refused alone, so it still ends at the tenant 404', async () => {
    await run('/se/sv', { tenantRefusal: { statusCode: 404 } });

    expect(resolveSessionMock).not.toHaveBeenCalled();
  });

  it('leaves a request without a hostname alone', async () => {
    const event = {
      path: '/api/cart/items',
      context: { tenant: { hostname: '' } },
    } as unknown as H3Event;

    await middleware(event);

    expect(resolveSessionMock).not.toHaveBeenCalled();
  });

  it('leaves a request without a tenant context alone', async () => {
    const event = {
      path: '/api/cart/items',
      context: {},
    } as unknown as H3Event;

    await middleware(event);

    expect(resolveSessionMock).not.toHaveBeenCalled();
  });

  it('never throws, even when the session cannot be decided', async () => {
    resolveSessionMock.mockResolvedValue(undefined);

    await expect(run('/api/orders')).resolves.toBeDefined();
  });

  it('never throws, even when resolving fails outright', async () => {
    resolveSessionMock.mockRejectedValue(new Error('unexpected'));

    await expect(run('/api/orders')).resolves.toBeDefined();
  });
});
