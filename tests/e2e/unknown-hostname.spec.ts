import { test, expect } from '@playwright/test';

/**
 * Unregistered hostname
 *
 * A hostname the merchant API does not know must answer 404 — "this is not a
 * thing" — not 500 — "retry later". The 500 hid a config problem behind what
 * looked like an outage (a release was rolled back on that reading), and it
 * filled the error log on every probe of an unknown subdomain.
 *
 * The Host header is overridden on the request context, so this needs no DNS
 * entry, no second tenant and no login: the connection goes to the test
 * server, the server sees an unknown hostname.
 */

const UNREGISTERED_HOST = 'unregistered-tenant.litium.portal';

test.describe('Unregistered hostname', () => {
  test('answers browsers with the 404 page, not a 500', async ({ request }) => {
    const response = await request.get('/se/sv/', {
      headers: { host: UNREGISTERED_HOST, accept: 'text/html' },
      maxRedirects: 0,
    });

    expect(response.status()).toBe(404);
    expect(response.headers()['content-type']).toContain('text/html');
    // No tenant resolved, so no tenant header.
    expect(response.headers()['x-tenant-id']).toBeUndefined();
    expect(response.headers()['x-correlation-id']).toBeTruthy();

    const body = await response.text();
    expect(body).toContain('Store not yet available');
    expect(body).toContain('This site is not available');
    expect(body).not.toContain('Nuxt I18n');
  });

  test('answers API clients with 404 JSON and the friendly message', async ({
    request,
  }) => {
    const response = await request.get('/se/sv/', {
      headers: { host: UNREGISTERED_HOST, accept: 'application/json' },
      maxRedirects: 0,
    });

    expect(response.status()).toBe(404);
    expect(response.headers()['x-tenant-id']).toBeUndefined();

    const body = await response.json();
    expect(body).toMatchObject({
      error: true,
      statusCode: 404,
      hostname: UNREGISTERED_HOST,
    });
    expect(body.message).toContain('This site is not available');
    expect(body.tenantId).toBeUndefined();
  });
});
