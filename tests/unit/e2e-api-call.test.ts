import { describe, it, expect } from 'vitest';
import { isApiCall, apiRoute } from '../e2e/api-call';

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
