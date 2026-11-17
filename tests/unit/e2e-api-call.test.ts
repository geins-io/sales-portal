import { describe, it, expect, vi } from 'vitest';
import type { APIRequestContext, APIResponse } from '@playwright/test';
import { isApiCall, apiRoute, apiGet } from '../e2e/api-call';

describe('isApiCall', () => {
  it('matches the pathname whatever query the call carries', () => {
    for (const url of [
      'http://shop.test/api/checkout/create-order',
      'http://shop.test/api/checkout/create-order?locale=sv',
      'http://shop.test/api/checkout/create-order?market=se&locale=en#x',
      '/api/checkout/create-order?locale=en',
    ]) {
      expect(isApiCall(url, '/api/checkout/create-order'), url).toBe(true);
    }
  });

  it('does not match another route that shares its start or end', () => {
    for (const url of [
      'http://shop.test/api/checkout/create-order-draft',
      'http://shop.test/api/checkout',
      'http://shop.test/x/api/checkout/create-order',
      'http://shop.test/api/quotes/requests',
    ]) {
      expect(isApiCall(url, '/api/checkout/create-order'), url).toBe(false);
    }
    expect(
      isApiCall('http://shop.test/api/quotes/requests', '/api/quotes'),
    ).toBe(false);
  });

  it('takes * as one segment', () => {
    const path = '/api/configurations/*/changes';
    expect(isApiCall('/api/configurations/abc-1/changes?locale=en', path)).toBe(
      true,
    );
    expect(isApiCall('/api/configurations/a/b/changes', path)).toBe(false);
    expect(isApiCall('/api/configurations//changes', path)).toBe(false);
  });

  it('takes a trailing /** as the path and everything below it', () => {
    const path = '/api/quotes/q-1/**';
    expect(isApiCall('/api/quotes/q-1?locale=en', path)).toBe(true);
    expect(isApiCall('/api/quotes/q-1/release', path)).toBe(true);
    expect(isApiCall('/api/quotes/q-10', path)).toBe(false);
  });

  it('reads the segments literally, not as a pattern', () => {
    expect(isApiCall('/api/products/s1x200', '/api/products/s1.200')).toBe(
      false,
    );
  });
});

describe('apiRoute', () => {
  it('gives route() a matcher on the pathname', () => {
    const match = apiRoute('/api/cart/items');
    expect(match(new URL('http://shop.test/api/cart/items?locale=da'))).toBe(
      true,
    );
    expect(match(new URL('http://shop.test/api/cart'))).toBe(false);
  });
});

/** A request context whose GETs answer `answers` in order; a string answer throws. */
function fakeRequest(...answers: (number | string)[]) {
  const write = vi.fn();
  const get = vi.fn(async () => {
    const answer = answers.shift();
    if (answer === undefined) throw new Error('no more answers');
    if (typeof answer === 'string') throw new Error(answer);
    return { status: () => answer } as APIResponse;
  });
  const request = {
    get,
    post: write,
    put: write,
    patch: write,
    delete: write,
    fetch: write,
    head: write,
  } as unknown as APIRequestContext;
  return { request, get, write };
}

describe('apiGet', () => {
  it('answers with the second try when the first is a 502', async () => {
    const { request, get } = fakeRequest(502, 200);
    const response = await apiGet(request, '/api/quotes');
    expect(response.status()).toBe(200);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('tries twice at most and answers the second failure', async () => {
    const { request, get } = fakeRequest(502, 502, 200);
    const response = await apiGet(request, '/api/quotes');
    expect(response.status()).toBe(502);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('retries the statuses ofetch retries', async () => {
    for (const status of [408, 409, 425, 429, 500, 502, 503, 504]) {
      const { request, get } = fakeRequest(status, 200);
      expect((await apiGet(request, '/api/cart')).status(), `${status}`).toBe(
        200,
      );
      expect(get).toHaveBeenCalledTimes(2);
    }
  });

  it('answers any other status at once', async () => {
    for (const status of [200, 204, 400, 401, 403, 404, 422, 501]) {
      const { request, get } = fakeRequest(status, 200);
      expect((await apiGet(request, '/api/cart')).status(), `${status}`).toBe(
        status,
      );
      expect(get).toHaveBeenCalledTimes(1);
    }
  });

  it('retries a call that threw, as ofetch does for a lost response', async () => {
    const { request, get } = fakeRequest('socket hang up', 200);
    expect((await apiGet(request, '/api/orders')).status()).toBe(200);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('throws when the second try throws too', async () => {
    const { request, get } = fakeRequest('socket hang up', 'timed out', 200);
    await expect(apiGet(request, '/api/orders')).rejects.toThrow('timed out');
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('sends the same url and options on both tries', async () => {
    const { request, get } = fakeRequest(503, 200);
    const options = { params: { cartId: 'c-1' } };
    await apiGet(request, '/api/cart', options);
    expect(get).toHaveBeenNthCalledWith(1, '/api/cart', options);
    expect(get).toHaveBeenNthCalledWith(2, '/api/cart', options);
  });

  it('only ever reads: a write is never sent, let alone retried', async () => {
    const { request, write } = fakeRequest(502, 502);
    await apiGet(request, '/api/cart/items');
    expect(write).not.toHaveBeenCalled();
  });
});
