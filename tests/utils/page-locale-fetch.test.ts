import { describe, it, expect, vi } from 'vitest';
import {
  withPageLocale,
  sendPageLocaleWithFetch,
} from '../../app/utils/page-locale-fetch';

const page = {
  origin: 'https://shop.test',
  pathname: '/se/en/portal/products',
};

describe('withPageLocale', () => {
  it("adds the locale of the page's URL to a call to an /api route", () => {
    expect(withPageLocale('/api/orders/products', page)).toBe(
      '/api/orders/products?locale=en',
    );
  });

  it('keeps the query and hash the call already has', () => {
    expect(withPageLocale('/api/search/products?q=pipe#top', page)).toBe(
      '/api/search/products?q=pipe&locale=en#top',
    );
  });

  it('adds them to an absolute URL of the same site, and to a URL object', () => {
    expect(withPageLocale('https://shop.test/api/cart', page)).toBe(
      'https://shop.test/api/cart?locale=en',
    );
    const url = withPageLocale(new URL('https://shop.test/api/cart'), page);
    expect(String(url)).toBe('https://shop.test/api/cart?locale=en');
  });

  it.each([
    ['another site', 'https://other.test/api/cart'],
    ['a page path', '/se/en/portal'],
    ['an asset', '/_nuxt/entry.js'],
    ['a path that only starts like the api', '/apis/cart'],
    ['a call that names its locale', '/api/products/by-ids?ids=1&locale=sv'],
  ])('leaves %s as it is', (_case, input) => {
    expect(withPageLocale(input, page)).toBe(input);
  });

  it('adds it to a call that names only its market, which it leaves alone', () => {
    expect(withPageLocale('/api/products/by-ids?ids=1&market=no', page)).toBe(
      '/api/products/by-ids?ids=1&market=no&locale=en',
    );
  });

  it('leaves a call as it is when the page has no market and locale in its URL', () => {
    expect(withPageLocale('/api/cart', { ...page, pathname: '/' })).toBe(
      '/api/cart',
    );
  });

  it('passes a Request object through untouched', () => {
    const request = new Request('https://shop.test/api/cart');
    expect(withPageLocale(request, page)).toBe(request);
  });
});

describe('sendPageLocaleWithFetch', () => {
  it("sends every fetch through with the current page's locale, its options untouched", async () => {
    const original = vi.fn(async () => new Response('ok'));
    const target = { fetch: original as typeof fetch };
    let current = page;
    sendPageLocaleWithFetch(target, () => current);
    const init = { method: 'POST', body: '{}' };

    await target.fetch('/api/checkout/token', init);
    current = { ...page, pathname: '/se/sv/cart' };
    await target.fetch('/api/cart');

    expect(original.mock.calls).toEqual([
      ['/api/checkout/token?locale=en', init],
      ['/api/cart?locale=sv', undefined],
    ]);
  });
});
