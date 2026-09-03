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
      // Types are the contract with @geins/types and the tenant config schema.
      // Silencing the compiler hides drift instead of fixing it: extend the type
      // (e.g. shared/types/commerce.ts) rather than casting. The few legitimate
      // exceptions carry a targeted eslint-disable with a reason.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
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
    // Guard: e2e specs declare why a test does not run. A bare skip conflates
    // "out of scope", "blocked" and "we don't know", and the last one must
    // fail the run (tests/e2e/reporters/scope-reporter.ts). Only helpers.ts
    // may call test.skip, inside outOfScope().
    files: ['tests/e2e/**/*.ts'],
    ignores: ['tests/e2e/helpers.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          // test.skip(...), setup.skip(...), test.fixme(...), test.describe.skip(...)
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name=/^(skip|fixme)$/]",
          message:
            'Declare why the test does not run with outOfScope(condition, reason, detail) from ./helpers — see ScopeReason there. A permanently skipped test is deleted, not parked.',
        },
      ],
    },
  })
  .append({
    // Guard: entity URLs (/p/, /c/, /b/) must be built via route-helpers, not hand-crafted literals.
    // Scoped to app code; the app/** glob already excludes shared/utils/route-helpers.ts.
    files: ['app/**/*.vue', 'app/**/*.ts'],
    ignores: ['tests/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          // Flag localePath(`/p/...`) / localePath(`/c/...`) / localePath(`/b/...`) and navigateTo(`/p/...`)
          selector:
            "CallExpression[callee.name=/^(localePath|navigateTo)$/] > TemplateLiteral[quasis.0.value.raw=/^[/][pcb][/]/]",
          message:
            "Build entity URLs with productPath/categoryPath/brandPath from shared/utils/route-helpers, then localePath(): see docs/adr/015-type-prefixed-routing.md",
        },
        {
          // Flag localePath('/p/...') / navigateTo('/p/...') with a plain string literal
          selector:
            "CallExpression[callee.name=/^(localePath|navigateTo)$/] > Literal[value=/^[/][pcb][/]/]",
          message:
            "Build entity URLs with productPath/categoryPath/brandPath from shared/utils/route-helpers, then localePath(): see docs/adr/015-type-prefixed-routing.md",
        },
        {
          // Flag router.push(`/p/...`) / router.replace(`/p/...`) with a bare template literal
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.object.name='router'][callee.property.name=/^(push|replace)$/] > TemplateLiteral[quasis.0.value.raw=/^[/][pcb][/]/]",
          message:
            "Build entity URLs with productPath/categoryPath/brandPath from shared/utils/route-helpers, then localePath(): see docs/adr/015-type-prefixed-routing.md",
        },
        {
          // Flag router.push('/p/...') / router.replace('/p/...') with a plain string literal
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.object.name='router'][callee.property.name=/^(push|replace)$/] > Literal[value=/^[/][pcb][/]/]",
          message:
            "Build entity URLs with productPath/categoryPath/brandPath from shared/utils/route-helpers, then localePath(): see docs/adr/015-type-prefixed-routing.md",
        },
        // CMS-page semantic slugs: resolve via useCmsPageLink(CMS_TAGS.X) instead of
        // hardcoding. Longest-match first (contact-form before contact,
        // apply-for-account before apply) to keep the regex alternation unambiguous.
        // These entries are the fast-feedback layer; the deny-by-default Layer B scan
        // in tests/unit/lint/cms-page-link-literals.test.ts is the authoritative guard.
        // Drift guard: tests/unit/lint/cms-page-link-literals.test.ts asserts every
        // CMS_SEMANTIC_SLUG_KEYS entry from shared/constants/cms.ts appears here.
        {
          // localePath('/contact-form...') / navigateTo('/contact-form...') template literal
          selector:
            "CallExpression[callee.name=/^(localePath|navigateTo)$/] > TemplateLiteral[quasis.0.value.raw=/^\\/(?:contact-form|contact|apply-for-account|apply|terms)(?:[/?#]|$)/]",
          message:
            "Resolve CMS pages via useCmsPageLink(CMS_TAGS.X) - hardcoded slugs 404 on tenants with localized page URLs: see docs/adr/019-bulletproof-routing.md",
        },
        {
          // localePath('/contact-form...') / navigateTo('/contact-form...') plain string
          selector:
            "CallExpression[callee.name=/^(localePath|navigateTo)$/] > Literal[value=/^\\/(?:contact-form|contact|apply-for-account|apply|terms)(?:[/?#]|$)/]",
          message:
            "Resolve CMS pages via useCmsPageLink(CMS_TAGS.X) - hardcoded slugs 404 on tenants with localized page URLs: see docs/adr/019-bulletproof-routing.md",
        },
        {
          // router.push('/contact-form...') / router.replace('/contact-form...') template literal
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.object.name='router'][callee.property.name=/^(push|replace)$/] > TemplateLiteral[quasis.0.value.raw=/^\\/(?:contact-form|contact|apply-for-account|apply|terms)(?:[/?#]|$)/]",
          message:
            "Resolve CMS pages via useCmsPageLink(CMS_TAGS.X) - hardcoded slugs 404 on tenants with localized page URLs: see docs/adr/019-bulletproof-routing.md",
        },
        {
          // router.push('/contact-form...') / router.replace('/contact-form...') plain string
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.object.name='router'][callee.property.name=/^(push|replace)$/] > Literal[value=/^\\/(?:contact-form|contact|apply-for-account|apply|terms)(?:[/?#]|$)/]",
          message:
            "Resolve CMS pages via useCmsPageLink(CMS_TAGS.X) - hardcoded slugs 404 on tenants with localized page URLs: see docs/adr/019-bulletproof-routing.md",
        },
        // B3: useRouter().push('/terms') / useRouter().replace('/terms'). The existing
        // router.push selectors only fire when the object is an identifier named 'router';
        // this form calls useRouter() inline so the object is a CallExpression.
        {
          // useRouter().push('/contact-form...') / useRouter().replace(...) plain string
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.object.type='CallExpression'][callee.object.callee.name='useRouter'][callee.property.name=/^(push|replace)$/] > Literal[value=/^\\/(?:contact-form|contact|apply-for-account|apply|terms)(?:[/?#]|$)/]",
          message:
            "Resolve CMS pages via useCmsPageLink(CMS_TAGS.X) - hardcoded slugs 404 on tenants with localized page URLs: see docs/adr/019-bulletproof-routing.md",
        },
        {
          // useRouter().push(`/contact-form...`) / useRouter().replace(...) template literal
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.object.type='CallExpression'][callee.object.callee.name='useRouter'][callee.property.name=/^(push|replace)$/] > TemplateLiteral[quasis.0.value.raw=/^\\/(?:contact-form|contact|apply-for-account|apply|terms)(?:[/?#]|$)/]",
          message:
            "Resolve CMS pages via useCmsPageLink(CMS_TAGS.X) - hardcoded slugs 404 on tenants with localized page URLs: see docs/adr/019-bulletproof-routing.md",
        },
        // B4: navigateTo({ path: '/terms' }) - the object-form of navigateTo evaded
        // the scalar-arg selectors above. Flag the path/to property literal inside
        // an ObjectExpression passed to navigateTo.
        {
          // navigateTo({ path: '/terms' }) plain string
          selector:
            "CallExpression[callee.name='navigateTo'] > ObjectExpression > Property[key.name=/^(path|to)$/] > Literal[value=/^\\/(?:contact-form|contact|apply-for-account|apply|terms)(?:[/?#]|$)/]",
          message:
            "Resolve CMS pages via useCmsPageLink(CMS_TAGS.X) - hardcoded slugs 404 on tenants with localized page URLs: see docs/adr/019-bulletproof-routing.md",
        },
        {
          // navigateTo({ path: `/terms` }) template literal
          selector:
            "CallExpression[callee.name='navigateTo'] > ObjectExpression > Property[key.name=/^(path|to)$/] > TemplateLiteral[quasis.0.value.raw=/^\\/(?:contact-form|contact|apply-for-account|apply|terms)(?:[/?#]|$)/]",
          message:
            "Resolve CMS pages via useCmsPageLink(CMS_TAGS.X) - hardcoded slugs 404 on tenants with localized page URLs: see docs/adr/019-bulletproof-routing.md",
        },
      ],
      // B2: bound :to/:href directive with a literal value matching a semantic slug.
      // Catches :to="'/terms'" and :to="`/terms`" which evade the call-expression
      // selectors in no-restricted-syntax above. vue/no-restricted-syntax traverses
      // the full template AST (VAttribute nodes) via vue-eslint-parser.
      'vue/no-restricted-syntax': [
        'error',
        {
          // :to="'/contact-form...'" (bound directive, plain string Literal)
          selector:
            "VAttribute[directive=true][key.argument.name=/^(to|href)$/] > VExpressionContainer > Literal[value=/^\\/(?:contact-form|contact|apply-for-account|apply|terms)(?:[/?#]|$)/]",
          message:
            "Resolve CMS pages via useCmsPageLink(CMS_TAGS.X) - hardcoded slugs 404 on tenants with localized page URLs: see docs/adr/019-bulletproof-routing.md",
        },
        {
          // :to="`/contact-form...`" (bound directive, template literal)
          selector:
            "VAttribute[directive=true][key.argument.name=/^(to|href)$/] > VExpressionContainer > TemplateLiteral[quasis.0.value.raw=/^\\/(?:contact-form|contact|apply-for-account|apply|terms)(?:[/?#]|$)/]",
          message:
            "Resolve CMS pages via useCmsPageLink(CMS_TAGS.X) - hardcoded slugs 404 on tenants with localized page URLs: see docs/adr/019-bulletproof-routing.md",
        },
      ],
    },
  });
