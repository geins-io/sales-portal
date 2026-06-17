import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (rel: string) =>
  readFileSync(resolve(__dirname, '../../', rel), 'utf-8');

/**
 * Store-settings button color class.
 *
 * Standalone CTAs (NuxtLink-as-button) must use the `bg-button-background`
 * token (the shared Button default variant) so they inherit the store's
 * general button color, NOT the raw `bg-primary` accent token. The signature
 * of the regression is the `hover:bg-primary/90` button hover; assert it is
 * gone and the mirrored `bg-button-background` hover is present.
 *
 * Tested at source level (node tier), same approach as ButtonsWidget.
 */
describe('store-settings button color on standalone CTAs', () => {
  const ctaFiles = [
    'app/components/checkout/OrderConfirmation.vue',
    'app/components/shared/EmptyState.vue',
    'app/components/pages/CartPage.vue',
    'app/pages/quote-confirmation/[id].vue',
  ];

  for (const file of ctaFiles) {
    it(`${file} uses the button-background token for its CTA`, () => {
      const source = read(file);
      expect(source).toContain('bg-button-background');
      expect(source).toContain('hover:bg-button-background/90');
      expect(source).not.toContain('hover:bg-primary/90');
    });
  }
});

/**
 * Store-settings theme inheritance on the error pages.
 *
 * The Nitro `render:html` hook that injects the tenant theme does not run on
 * either error render path, so both must re-inject the theme themselves:
 *  - `server/error.ts` renders the self-contained HTML for server-side errors
 *    (hard-nav 404/500). Behavior is asserted in error-handler.test.ts; here we
 *    guard that it still wires the theme inputs at the source level.
 *  - `app/error.vue` renders client-caught errors and re-injects the theme via
 *    useHead from the resolved tenant config.
 *
 * Both inject the `data-theme` attribute, the sanitized tenant css block and
 * the Google Fonts link, so neither path falls back to the hardcoded palette.
 */
describe('client error page (error.vue) inherits store-settings theme', () => {
  const source = read('app/error.vue');

  it('injects the data-theme attribute and tenant css style block', () => {
    expect(source).toContain('data-theme');
    expect(source).toContain('data-tenant-theme');
    expect(source).toContain('htmlAttrs');
  });

  it('sanitizes the tenant css before injecting it', () => {
    expect(source).toContain('sanitizeTenantCss');
  });

  it('injects the tenant Google Fonts stylesheet', () => {
    expect(source).toContain('buildGoogleFontsUrl');
    expect(source).toContain('fonts.googleapis.com');
  });
});

describe('server error handler (error.ts) inherits store-settings theme', () => {
  const source = read('server/error.ts');

  it('reads the tenant theme off the resolved config', () => {
    expect(source).toContain('event.context.tenant?.config');
    expect(source).toContain('sanitizeTenantCss');
    expect(source).toContain('buildGoogleFontsUrl');
  });

  it('uses the store-settings button color token for the primary button', () => {
    expect(source).toContain('var(--button-background');
  });
});
