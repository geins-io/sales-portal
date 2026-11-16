import { RuleTester } from 'eslint';
import rule from '../../../eslint-rules/no-api-url-literal.js';

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

const errors = [{ messageId: 'pathnameOnly' }];

tester.run('no-api-url-literal', rule, {
  valid: [
    "page.route(apiRoute('/api/checkout/create-order'), handler)",
    "page.waitForRequest((r) => isApiCall(r.url(), '/api/cart'))",
    "page.waitForResponse((r) => isApiCall(r.url(), '/api/configurations/reopen') && r.ok())",
    "page.route('**/cdn.litium.media/**', handler)",
    "page.goto('/se/sv/portal')",
    "page.waitForURL('**/se/sv/portal/products')",
    "expect(path.endsWith('/cart')).toBe(true)",
    "const ok = url === '/se/sv/'",
    "page.request.get('/api/cart', { params })",
    "page.waitForResponse((r) => new URL(r.url()).pathname.endsWith('/commit'))",
    "expect(page.url()).toContain('/se/sv/cart')",
    'const same = a.url === b.url',
    "page.waitForResponse((r) => new URL(r.url()).pathname === '/api/cart/items')",
    'const hit = `/api/configurations/${id}/renew` === new URL(u).pathname',
    'const hit = /\\/se\\/sv\\/cart$/.test(page.url())',
  ],
  invalid: [
    { code: "page.route('**/api/checkout/create-order', handler)", errors },
    { code: 'page.route(`**/api/quotes/${id}**`, handler)', errors },
    { code: "context.route('**/api/cart/items', handler)", errors },
    { code: "page.unroute('**/api/quotes', handler)", errors },
    { code: "page.waitForRequest('**/api/cart')", errors },
    { code: "page.waitForResponse('**/api/configurations/reopen')", errors },
    {
      code: "page.waitForRequest((r) => r.url().endsWith('/api/configurations/from-order'))",
      errors,
    },
    { code: "const hit = request.url() === 'http://x/api/cart'", errors },
    { code: "if ('/api/cart' !== url) {}", errors },
    {
      code: "page.waitForResponse((r) => r.url().endsWith('/commit') && r.ok())",
      errors,
    },
    { code: 'const hit = r.url().endsWith(suffix)', errors },
    { code: 'const hit = request.url() === target', errors },
    { code: 'const miss = expected !== response.url()', errors },
    {
      code: 'page.waitForResponse((r) => /\\/api\\/configurations\\/[^/]+\\/cart$/.test(r.url()))',
      errors,
    },
    { code: 'page.route(/\\/api\\/cart/, handler)', errors },
  ],
});
