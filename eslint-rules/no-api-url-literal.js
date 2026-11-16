/**
 * ESLint rule: no-api-url-literal (tests/e2e)
 *
 * Every browser call to our own `/api` routes carries the page's `?locale=`
 * (ADR-026), so a string that matches the whole URL misses it. For an
 * intercept that means failing open: the request reaches the server, and a
 * write the test meant to answer itself happens for real. Calls are matched
 * by pathname with `isApiCall` / `apiRoute` from `tests/e2e/api-call.ts`.
 *
 * Bad:  page.route('**\/api/checkout/create-order', …)
 *       page.waitForResponse((r) => r.url().endsWith('/commit'))
 *       page.waitForRequest((r) => r.url().endsWith('/api/cart'))
 *       /\/api\/configurations\/[^/]+\/cart$/.test(r.url())
 * Good: page.route(apiRoute('/api/checkout/create-order'), …)
 *       page.waitForRequest((r) => isApiCall(r.url(), '/api/cart'))
 */
const URL_MATCHERS = new Set([
  'route',
  'unroute',
  'waitForRequest',
  'waitForResponse',
]);

function isApiString(node) {
  if (!node) return false;
  if (node.type === 'Literal') {
    return typeof node.value === 'string' && node.value.includes('/api/');
  }
  if (node.type === 'TemplateLiteral') {
    return node.quasis.some((quasi) => quasi.value.cooked?.includes('/api/'));
  }
  return false;
}

/** A regex literal written against an /api URL. */
function isApiRegex(node) {
  return Boolean(node?.regex?.pattern.includes('\\/api\\/'));
}

/** `x.url()`: a request's or response's whole URL, query included. */
function isUrlCall(node) {
  return (
    node?.type === 'CallExpression' &&
    node.arguments.length === 0 &&
    node.callee.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.property.name === 'url'
  );
}

/** `….pathname`: a comparison with the pathname already ignores the query. */
function isPathname(node) {
  return (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.name === 'pathname'
  );
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Match an /api call in e2e tests by its pathname, not by its whole URL',
    },
    messages: {
      pathnameOnly:
        'Match an /api call by its pathname with apiRoute() or isApiCall() from ./api-call. Every browser /api call carries ?locale=, so a whole-URL match misses it and an intercepted write goes through for real.',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== 'MemberExpression') return;
        const name = node.callee.property.name;
        const [first] = node.arguments;
        if (name === 'endsWith' && isUrlCall(node.callee.object)) {
          // The end of a whole URL is its query, whatever the suffix.
          context.report({ node, messageId: 'pathnameOnly' });
          return;
        }
        if (
          (URL_MATCHERS.has(name) || name === 'endsWith') &&
          isApiString(first)
        ) {
          context.report({ node: first, messageId: 'pathnameOnly' });
        }
        if (URL_MATCHERS.has(name) && isApiRegex(first)) {
          context.report({ node: first, messageId: 'pathnameOnly' });
        }
        if (name === 'test' && isApiRegex(node.callee.object)) {
          context.report({
            node: node.callee.object,
            messageId: 'pathnameOnly',
          });
        }
      },
      BinaryExpression(node) {
        if (!['===', '!==', '==', '!='].includes(node.operator)) return;
        if (isUrlCall(node.left) || isUrlCall(node.right)) {
          context.report({ node, messageId: 'pathnameOnly' });
          return;
        }
        for (const [side, other] of [
          [node.left, node.right],
          [node.right, node.left],
        ]) {
          if (isApiString(side) && !isPathname(other)) {
            context.report({ node: side, messageId: 'pathnameOnly' });
          }
        }
      },
    };
  },
};
