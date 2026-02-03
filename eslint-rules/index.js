/**
 * Custom ESLint rules for Sales Portal
 */
import requireRuntimeConfigEvent from './require-runtime-config-event.js';

export default {
  rules: {
    'require-runtime-config-event': requireRuntimeConfigEvent,
  },
};
