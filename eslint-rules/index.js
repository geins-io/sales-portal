/**
 * Custom ESLint rules for Sales Portal
 */
import requireRuntimeConfigEvent from './require-runtime-config-event.js';
import noApiUrlLiteral from './no-api-url-literal.js';
import apiGetThroughHelper from './api-get-through-helper.js';

export default {
  rules: {
    'require-runtime-config-event': requireRuntimeConfigEvent,
    'no-api-url-literal': noApiUrlLiteral,
    'api-get-through-helper': apiGetThroughHelper,
  },
};
