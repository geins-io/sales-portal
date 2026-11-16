/**
 * Custom ESLint rules for Sales Portal
 */
import requireRuntimeConfigEvent from './require-runtime-config-event.js';
import noApiUrlLiteral from './no-api-url-literal.js';

export default {
  rules: {
    'require-runtime-config-event': requireRuntimeConfigEvent,
    'no-api-url-literal': noApiUrlLiteral,
  },
};
