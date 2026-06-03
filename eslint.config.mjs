import { createConfigForNuxt } from '@nuxt/eslint-config/flat';
import prettierPlugin from 'eslint-plugin-prettier/recommended';
import tailwind from 'eslint-plugin-tailwindcss';
import customRules from './eslint-rules/index.js';

const { eslintPluginPrettierRecommended } = prettierPlugin;

export default createConfigForNuxt()
  .append(eslintPluginPrettierRecommended)
  .append(tailwind.configs['flat/recommended'])
  .append({
    settings: {
      tailwindcss: {
        // Tailwind v4 uses inline config, so provide an empty object to silence path warnings.
        config: {},
      },
    },
    rules: {
      'vue/require-default-prop': 'off',
      'vue/no-multiple-template-root': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/html-self-closing': [
        'warn',
        {
          html: {
            void: 'any',
            normal: 'always',
            component: 'always',
          },
          svg: 'always',
          math: 'always',
        },
      ],
      'tailwindcss/no-custom-classname': 'off',
    },
  })
  .append({
    // Custom rules for server code
    files: ['server/**/*.ts'],
    plugins: {
      'sales-portal': customRules,
    },
    rules: {
      'sales-portal/require-runtime-config-event': 'error',
    },
  })
  .append({
    // Guard: entity URLs (/p/, /c/, /b/) must be built via route-helpers, not hand-crafted literals.
    // Scoped to app code; excludes shared/utils/route-helpers.ts (where the prefixes are defined) and tests.
    files: ['app/**/*.vue', 'app/**/*.ts'],
    ignores: ['shared/utils/route-helpers.ts', 'tests/**', 'app/components/pages/ProductDetails.vue', 'app/components/pages/ProductList.vue', 'app/pages/[...slug].vue'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          // Flag localePath(`/p/...`) / localePath(`/c/...`) / localePath(`/b/...`) and navigateTo(...)
          selector:
            "CallExpression[callee.name=/^(localePath|navigateTo)$/] > TemplateLiteral[quasis.0.value.raw=/^[/][pcb][/]/]",
          message:
            "Build entity URLs with productPath/categoryPath/brandPath from shared/utils/route-helpers, then localePath(): see ADR-015 / hard-blocks",
        },
        {
          // Flag router.push(`/p/...`) / router.replace(`/p/...`) with a bare template literal
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.object.name='router'][callee.property.name=/^(push|replace)$/] > TemplateLiteral[quasis.0.value.raw=/^[/][pcb][/]/]",
          message:
            "Build entity URLs with productPath/categoryPath/brandPath from shared/utils/route-helpers, then localePath(): see ADR-015 / hard-blocks",
        },
      ],
    },
  });
