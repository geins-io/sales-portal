import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * Lint-style regression test: scans app/ for bare route paths that bypass
 * the locale prefix. All navigation must use localePath() in components
 * or cookie-based prefix in middleware.
 *
 * See: docs/conventions/ssr.md → "Locale-Safe Navigation"
 */

const APP_DIR = join(__dirname, '../../../app');

/** Files/directories excluded from scanning */
const EXCLUDED_PATHS = ['elements.vue'];

/** Extensions to scan */
const SCAN_EXTENSIONS = ['.vue', '.ts'];

/**
 * Patterns that indicate a bare route path without localePath().
 * Each regex matches a bare path that should use localePath() instead.
 */
const BARE_PATH_PATTERNS = [
  // Template: to="/something" (not :to which would be dynamic)
  { regex: /\bto="\/[a-z]/g, label: 'to="/..."' },
  // Programmatic: navigateTo('/something')
  { regex: /navigateTo\(\s*['"]\/[a-z]/g, label: "navigateTo('/...')" },
  // Programmatic: navigateTo({ path: '/something' })
  {
    regex: /navigateTo\(\s*\{\s*path:\s*['"]\/[a-z]/g,
    label: "navigateTo({ path: '/...' })",
  },
  // Programmatic: router.push('/something')
  { regex: /router\.push\(\s*['"]\/[a-z]/g, label: "router.push('/...')" },
  // Programmatic: router.replace('/something')
  {
    regex: /router\.replace\(\s*['"]\/[a-z]/g,
    label: "router.replace('/...')",
  },
];

function collectFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(current: string) {
    for (const entry of readdirSync(current)) {
      const fullPath = join(current, entry);
      const relPath = relative(APP_DIR, fullPath);

      if (EXCLUDED_PATHS.some((ex) => relPath.includes(ex))) continue;

      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (SCAN_EXTENSIONS.some((ext) => entry.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

describe('bare route paths lint', () => {
  it('should not have bare route paths in app/ (use localePath() instead)', () => {
    const files = collectFiles(APP_DIR);
    const violations: string[] = [];

    for (const filePath of files) {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip lines that already use localePath
        if (line.includes('localePath')) continue;

        for (const pattern of BARE_PATH_PATTERNS) {
          if (pattern.regex.test(line)) {
            const rel = relative(APP_DIR, filePath);
            violations.push(
              `  ${rel}:${i + 1} — ${pattern.label}: ${line.trim()}`,
            );
          }
          // Reset lastIndex for global regex
          pattern.regex.lastIndex = 0;
        }
      }
    }

    expect(
      violations,
      `Found ${violations.length} bare route path(s) that bypass locale prefix:\n${violations.join('\n')}\n\nUse localePath() from useLocaleMarket() instead.`,
    ).toHaveLength(0);
  });
});
