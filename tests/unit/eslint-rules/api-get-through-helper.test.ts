import { RuleTester } from 'eslint';
import rule from '../../../eslint-rules/api-get-through-helper.js';

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

const errors = [{ messageId: 'useApiGet' }];

tester.run('api-get-through-helper', rule, {
  valid: [
    "apiGet(page.request, '/api/cart', { params })",
    'apiGet(request, `/api/quotes/${id}`)',
    "page.request.post('/api/cart/items', { data })",
    'page.request.delete(`/api/quotes/${id}`)',
    "page.request.put('/api/cart/items', { data })",
    "page.request.patch('/api/quotes/q-1', { data })",
    "request.get('/se/sv/', { headers })",
    'page.request.get(`/${category.alias}`)',
    'page.request.get(path)',
    "params.get('locale')",
  ],
  invalid: [
    { code: "page.request.get('/api/cart', { params })", errors },
    { code: 'page.request.get(`/api/quotes/${id}`)', errors },
    { code: "request.get('/api/config', { headers })", errors },
    { code: "await (await page.request.get('/api/config')).json()", errors },
    { code: "buyer.request.get('/api/orders')", errors },
  ],
});
