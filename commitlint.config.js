/**
 * Conventional Commits config — see AGENTS.md § Commit Message Format.
 *
 * Format: `type(scope): description`
 *   - lowercase, imperative, no period, ≤72 chars
 *   - scope is single lowercase token (tenant, cart, portal, quotes, cms, …)
 *   - never include ticket numbers or PR refs in the subject
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'chore',
        'docs',
        'test',
        'refactor',
        'perf',
        'build',
        'ci',
        'style',
        'revert',
      ],
    ],
    'scope-empty': [2, 'never'],
    'scope-case': [2, 'always', 'lower-case'],
    // Acronyms (API, JSON, KV, CMS, SDK) are common in our subjects — don't
    // force them to lower-case. Type + scope are still enforced lowercase.
    'subject-case': [0],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 72],
  },
};
