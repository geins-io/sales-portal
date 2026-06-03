import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * Lint-style regression test: scans app/ for hand-built entity-URL literals
 * (/p/ /c/ /b/) passed directly to localePath(), navigateTo(), router.push(),
 * or router.replace(). All entity URLs must be built via productPath /
 * categoryPath / brandPath from shared/utils/route-helpers, then wrapped with
 * localePath().
 *
 * Call-scoped patterns: only navigation call sites are flagged. SEO/JSON-LD
 * strings that construct /p/ paths outside these calls are intentionally left
 * alone (they are not navigation args and must not be rewritten here).
 *
 * See: docs/conventions/, shared/utils/route-helpers.ts
 */

const APP_DIR = join(__dirname, '../../../app');

/** Extensions to scan */
const SCAN_EXTENSIONS = ['.vue', '.ts'];

/**
 * Call-scoped patterns: match a string or template literal beginning /p/, /c/,
 * or /b/ that is the DIRECT FIRST ARGUMENT of a navigation call. Patterns are
 * global so lastIndex must be reset between uses.
 */
const ENTITY_LITERAL_PATTERNS = [
  {
    regex: /localePath\(\s*[`'"]\/(p|c|b)\//g,
    label: "localePath('/p|c|b/...')",
  },
  {
    regex: /navigateTo\(\s*[`'"]\/(p|c|b)\//g,
    label: "navigateTo('/p|c|b/...')",
  },
  {
    regex: /router\.push\(\s*[`'"]\/(p|c|b)\//g,
    label: "router.push('/p|c|b/...')",
  },
  {
    regex: /router\.replace\(\s*[`'"]\/(p|c|b)\//g,
    label: "router.replace('/p|c|b/...')",
  },
];

function collectFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(current: string) {
    for (const entry of readdirSync(current)) {
      const fullPath = join(current, entry);
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

describe('entity-url literals lint', () => {
  it('should not pass hand-built /p|c|b/ literals directly to localePath/navigateTo/router calls', () => {
    const files = collectFiles(APP_DIR);
    const violations: string[] = [];

    for (const filePath of files) {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;

        for (const pattern of ENTITY_LITERAL_PATTERNS) {
          if (pattern.regex.test(line)) {
            const rel = relative(APP_DIR, filePath);
            violations.push(
              `  ${rel}:${i + 1} - ${pattern.label}: ${line.trim()}`,
            );
          }
          // Reset lastIndex for global regex before next line/pattern use.
          pattern.regex.lastIndex = 0;
        }
      }
    }

    expect(
      violations,
      `Found ${violations.length} hand-built entity-URL literal(s) in navigation calls:\n${violations.join('\n')}\n\nBuild entity URLs with productPath/categoryPath/brandPath from shared/utils/route-helpers, then wrap with localePath().`,
    ).toHaveLength(0);
  });
});
