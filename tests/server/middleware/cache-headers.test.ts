import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

const cookies: Record<string, string | undefined> = {};
const headers: Record<string, string> = {};
let query: Record<string, string> = {};

const getCookieMock = vi.fn((_event: unknown, name: string) => cookies[name]);
const getQueryMock = vi.fn(() => query);
const setHeaderMock = vi.fn((_event: unknown, name: string, value: string) => {
  headers[name.toLowerCase()] = value;
});

vi.stubGlobal('defineEventHandler', (fn: (e: H3Event) => unknown) => fn);
vi.stubGlobal('getCookie', getCookieMock);
vi.stubGlobal('getQuery', getQueryMock);
vi.stubGlobal('setHeader', setHeaderMock);

vi.mock('#shared/constants/storage', () => ({
  COOKIE_NAMES: {
    PREVIEW_MODE: 'preview_mode',
    STORE_SETTINGS_PREVIEW: 'store_settings_preview',
  },
}));

let middleware: (event: H3Event) => unknown;

beforeEach(async () => {
  /* eslint-disable @typescript-eslint/no-dynamic-delete */
  for (const k of Object.keys(cookies)) delete cookies[k];
  for (const k of Object.keys(headers)) delete headers[k];
  /* eslint-enable @typescript-eslint/no-dynamic-delete */
  query = {};
  vi.resetModules();
  middleware = (await import('../../../server/middleware/cache-headers'))
    .default as unknown as (event: H3Event) => unknown;
});

function run(path: string) {
  return middleware({ path } as unknown as H3Event);
}

describe('cache-headers middleware', () => {
  it('caches normal page responses at the CDN', () => {
    run('/sv/sv/');
    expect(headers['cache-control']).toBe(
      'public, s-maxage=60, stale-while-revalidate=600',
    );
    expect(headers['vary']).toBe('host, accept-encoding');
  });

  it('skips api routes entirely', () => {
    run('/api/config');
    expect(headers['cache-control']).toBeUndefined();
    expect(headers['vary']).toBeUndefined();
  });

  it('skips Nuxt internal asset routes', () => {
    run('/_nuxt/foo.js');
    expect(headers['cache-control']).toBeUndefined();
  });

  it('marks store-settings preview-cookie requests as uncacheable', () => {
    cookies.store_settings_preview = 'true';
    run('/sv/sv/');
    expect(headers['cache-control']).toBe('private, no-store');
    expect(headers['vary']).toBeUndefined();
  });

  it('marks CMS preview-cookie requests as uncacheable', () => {
    cookies.preview_mode = 'true';
    run('/sv/sv/');
    expect(headers['cache-control']).toBe('private, no-store');
  });

  it('marks ?preview=1 requests as uncacheable even without cookie', () => {
    query = { preview: '1' };
    run('/sv/sv/');
    expect(headers['cache-control']).toBe('private, no-store');
  });
});
