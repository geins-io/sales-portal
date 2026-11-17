/**
 * ESLint rule: api-get-through-helper (tests/e2e)
 *
 * The page reads our own `/api` routes with `useFetch`/`$fetch`, which retry a
 * failed GET once. A test that reads the same route with a bare
 * `request.get` fails on one stalled Geins call the page would have
 * recovered from. Reads go through `apiGet` from `tests/e2e/api-call.ts`;
 * writes are not flagged, they are never retried.
 *
 * Bad:  page.request.get('/api/cart', { params })
 * Good: apiGet(page.request, '/api/cart', { params })
 */
function isApiString(node) {
  if (!node) return false;
  if (node.type === 'Literal') {
    return typeof node.value === 'string' && node.value.startsWith('/api/');
  }
  if (node.type === 'TemplateLiteral') {
    return node.quasis[0].value.cooked?.startsWith('/api/') ?? false;
  }
  return false;
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Read our own /api routes in e2e tests with apiGet, which retries like the page',
    },
    messages: {
      useApiGet:
        'Read an /api route with apiGet() from ./api-call. The page retries a failed GET once; a bare request.get does not, so one stalled Geins call fails the test.',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;
        if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.property.name === 'get' &&
          isApiString(node.arguments[0])
        ) {
          context.report({ node, messageId: 'useApiGet' });
        }
      },
    };
  },
};
