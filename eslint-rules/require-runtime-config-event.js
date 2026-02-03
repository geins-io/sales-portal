/**
 * ESLint rule: require-runtime-config-event
 *
 * Enforces that useRuntimeConfig() in server/ files receives the event parameter.
 * This ensures proper request-scoped config in SSR and prevents subtle bugs.
 *
 * Bad:  const config = useRuntimeConfig()
 * Good: const config = useRuntimeConfig(event)
 */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require event parameter in useRuntimeConfig() calls within server routes',
    },
    messages: {
      missingEvent:
        'useRuntimeConfig() in server routes must receive event parameter: useRuntimeConfig(event)',
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename || context.getFilename();

    // Only apply to files in server/ directory
    if (!filename.includes('/server/')) {
      return {};
    }

    return {
      CallExpression(node) {
        // Check if it's a useRuntimeConfig call
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'useRuntimeConfig' &&
          node.arguments.length === 0
        ) {
          context.report({
            node,
            messageId: 'missingEvent',
          });
        }
      },
    };
  },
};
