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
    'app/components/cart/CartEmptyState.vue',
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
 * Store-settings theme inheritance on the server error page.
 *
 * The Nitro `render:html` hook that injects the tenant theme does not run for
 * `server/error.ts`, which renders the self-contained HTML for server-side
 * errors (hard-nav 404/500). Behavior is asserted in error-handler.test.ts;
 * here we guard that it still wires the theme inputs at the source level.
 * The client error page (`app/error.vue`) keeps the theme the server already
 * wrote into the document — covered end to end in tests/e2e/error-page.spec.ts.
 */
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
