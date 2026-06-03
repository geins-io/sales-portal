import { test, expect } from '@playwright/test';

/**
 * Content-Security-Policy regression guard.
 *
 * Inline styles (the tenant theme block, Vue/radix-vue positioning and
 * transition style attributes) must not be governed by a nonce or hash
 * allowlist: WebKit/Safari enforces style-src strictly and silently drops
 * every inline style that is not explicitly allowed, which blanks the store
 * settings colors and breaks positioned UI. The policy therefore allows inline
 * styles wholesale while keeping script execution locked down with a nonce.
 *
 * This test asserts the SERVED policy so it cannot regress to the strict form
 * that caused the Safari outage. It runs against a production build (CSP is
 * production-only); under `pnpm dev` there is no CSP header and it is skipped.
 */

function parseCsp(header: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const part of header.split(';')) {
    const [directive, ...sources] = part.trim().split(/\s+/);
    if (directive) out[directive] = sources;
  }
  return out;
}

test.describe('Content-Security-Policy', () => {
  test('allows inline styles and keeps scripts nonce-strict', async ({
    page,
  }) => {
    const response = await page.goto('/');
    const header = response?.headers()['content-security-policy'];

    if (!header) {
      test.info().annotations.push({
        type: 'note',
        description: 'no CSP header (dev server) — policy guard skipped',
      });
      return;
    }

    const csp = parseCsp(header);
    const styleSrc = csp['style-src'] ?? [];
    const scriptSrc = csp['script-src'] ?? [];

    // Styles: inline must be allowed, and NOT gated by nonce/hash (which would
    // break inline styles in WebKit again).
    expect(styleSrc, "style-src must allow 'unsafe-inline'").toContain(
      "'unsafe-inline'",
    );
    expect(
      styleSrc.some((s) => s.startsWith("'nonce-")),
      'style-src must not use a nonce (breaks client-injected inline styles in WebKit)',
    ).toBe(false);
    expect(
      styleSrc.some(
        (s) => s.startsWith("'sha256-") || s.startsWith("'sha384-"),
      ),
      'style-src must not rely on hashes (cannot cover dynamic inline styles)',
    ).toBe(false);

    // Scripts: the protection that matters stays strict.
    expect(
      scriptSrc.some((s) => s.startsWith("'nonce-")),
      'script-src must remain nonce-based',
    ).toBe(true);
    expect(
      scriptSrc,
      "script-src must not allow 'unsafe-inline'",
    ).not.toContain("'unsafe-inline'");
  });
});
