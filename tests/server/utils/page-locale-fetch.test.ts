import { describe, it, expect, vi } from 'vitest';
import type { H3Event } from 'h3';
import { sendPageLocaleWithApiCalls } from '../../../server/utils/page-locale-fetch';

// A page request whose render calls our own /api routes through event.$fetch
// (useFetch, internalFetch and useRequestFetch all do during SSR).
function pageRequest() {
  const $fetch = vi.fn(async () => 'ok');
  const event = { $fetch } as unknown as H3Event;
  sendPageLocaleWithApiCalls(event, 'en');
  return { event, $fetch };
}

describe('sendPageLocaleWithApiCalls', () => {
  it("adds the page's locale to a call to an /api route", async () => {
    const { event, $fetch } = pageRequest();

    await event.$fetch('/api/orders/products', { query: { page: 2 } });

    expect($fetch).toHaveBeenCalledWith('/api/orders/products', {
      query: { locale: 'en', page: 2 },
    });
  });

  it('adds it to a call without options', async () => {
    const { event, $fetch } = pageRequest();

    await event.$fetch('/api/cart');

    expect($fetch).toHaveBeenCalledWith('/api/cart', {
      query: { locale: 'en' },
    });
  });

  it('adds it to a call that names only its market, which it leaves alone', async () => {
    const { event, $fetch } = pageRequest();

    await event.$fetch('/api/products', { query: { market: 'no' } });

    expect($fetch).toHaveBeenCalledWith('/api/products', {
      query: { locale: 'en', market: 'no' },
    });
  });

  it.each([
    ['in its query option', '/api/products', { query: { locale: 'sv' } }],
    ['in its params option', '/api/products', { params: { locale: 'sv' } }],
    ['in its URL', '/api/products?market=se&locale=sv#top', undefined],
  ])(
    'leaves a call that names its own locale %s as it is',
    async (_case, url, init) => {
      const { event, $fetch } = pageRequest();

      await event.$fetch(url, init);

      expect($fetch).toHaveBeenCalledWith(url, init);
    },
  );

  it.each([
    ['a page path', '/se/en/portal'],
    ['an asset', '/_nuxt/entry.js'],
    ['another site', 'https://example.test/api/x'],
    ['a path that only starts like the api', '/apis/x'],
  ])('leaves a call to %s as it is', async (_case, url) => {
    const { event, $fetch } = pageRequest();

    await event.$fetch(url, { method: 'GET' });

    expect($fetch).toHaveBeenCalledWith(url, { method: 'GET' });
  });

  it('passes a Request object through untouched', async () => {
    const { event, $fetch } = pageRequest();
    const request = new Request('http://localhost/api/cart');

    await event.$fetch(request as unknown as string);

    expect($fetch).toHaveBeenCalledWith(request, undefined);
  });
});
