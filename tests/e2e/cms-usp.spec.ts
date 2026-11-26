import type { APIRequestContext } from '@playwright/test';
import { apiGet } from './api-call';
import { test, expect } from './fixtures';

/**
 * The USP block's icons: Material Symbols in the rounded outline style, served
 * from the server bundle by @nuxt/icon's endpoint. Nothing comes from outside
 * the site, so a name the bundle lacks gets no icon.
 */

interface IconResponse {
  prefix?: string;
  icons?: Record<string, { body?: string }>;
  aliases?: Record<string, { parent?: string }>;
}

async function fetchIcons(
  request: APIRequestContext,
  names: string[],
): Promise<{ status: number; body: IconResponse | null }> {
  const response = await apiGet(
    request,
    `/api/_nuxt_icon/material-symbols.json?icons=${names.join(',')}`,
  );
  const text = await response.text();
  return {
    status: response.status(),
    body: text ? (JSON.parse(text) as IconResponse | null) : null,
  };
}

test.describe('USP icons', () => {
  test('serves a rounded outline icon from the bundle', async ({ request }) => {
    const { status, body } = await fetchIcons(request, [
      'local-shipping-outline-rounded',
    ]);
    expect(status).toBe(200);
    expect(body?.prefix).toBe('material-symbols');
    expect(body?.icons?.['local-shipping-outline-rounded']?.body).toContain(
      '<path',
    );
  });

  test('serves an icon without an outline form through its rounded drawing', async ({
    request,
  }) => {
    const { status, body } = await fetchIcons(request, [
      'expand-more-outline-rounded',
    ]);
    expect(status).toBe(200);
    expect(body?.aliases?.['expand-more-outline-rounded']?.parent).toBe(
      'expand-more-rounded',
    );
    expect(body?.icons?.['expand-more-rounded']?.body).toContain('<path');
  });

  for (const name of ['local-shipping', 'no-such-icon-outline-rounded']) {
    test(`has no icon for ${name}`, async ({ request }) => {
      const { body } = await fetchIcons(request, [name]);
      expect(body?.icons?.[name]).toBeUndefined();
      expect(body?.aliases?.[name]).toBeUndefined();
    });
  }
});
