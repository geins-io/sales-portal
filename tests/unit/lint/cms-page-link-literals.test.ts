import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it, expect } from 'vitest';
import { CMS_SEMANTIC_SLUG_KEYS } from '#shared/constants/cms';

/**
 * Deny-by-default guard against hardcoded CMS-page link literals.
 *
 * Layer B: derives the allowlist of real route first-segments from the
 * top-level entries of app/pages/ and flags ANY hardcoded absolute link
 * literal in nav contexts whose first path segment is not a real app route,
 * catalog prefix, external URL, anchor, or /api path.
 *
 * Call-scoped: only localePath/navigateTo/router.push/router.replace first
 * args and static to="/..." attributes are scanned. Code comments and JSDoc
 * examples are not matched.
 *
 * See: docs/conventions/, docs/adr/019-bulletproof-routing.md
 */

const REPO_ROOT = join(__dirname, '../../..');
const APP_DIR = join(REPO_ROOT, 'app');
const PAGES_DIR = join(APP_DIR, 'pages');
const ESLINT_CONFIG = join(REPO_ROOT, 'eslint.config.mjs');

/** Extensions to scan */
const SCAN_EXTENSIONS = ['.vue', '.ts'];

/**
 * Dev-only showcase/testing files that are not shipped pages and may contain
 * non-route paths for demonstration purposes.
 */
const EXCLUDED_PATHS = [
  'elements.vue', // dev component showcase
  'preview-widgets', // dev preview harness
  'error-test.vue', // dev error test page
];

// ---------------------------------------------------------------------------
// Allowlist derivation
// ---------------------------------------------------------------------------

/**
 * Build the set of allowed first path-segments by reading the top-level
 * entries of app/pages/. Files become their stem (without extension);
 * directories become their name. Dynamic segments (starting with '[') are
 * skipped. Special entries: 'index' covers the root route and '/' is always
 * allowed.
 */
export function buildAllowlist(pagesDir: string): Set<string> {
  const allowed = new Set<string>(['index']);

  if (!existsSync(pagesDir)) return allowed;

  for (const entry of readdirSync(pagesDir)) {
    if (entry.startsWith('[')) continue; // dynamic catch-all, skip

    const stat = statSync(join(pagesDir, entry));
    if (stat.isDirectory()) {
      allowed.add(entry);
    } else {
      // Strip .vue extension
      const stem = entry.replace(/\.vue$/, '');
      allowed.add(stem);
    }
  }

  return allowed;
}

// ---------------------------------------------------------------------------
// Segment extraction helper
// ---------------------------------------------------------------------------

/**
 * Extract the first path segment from an absolute URL literal value.
 * Handles: /x, /x/, /x?q, /x#h, /x/y, and template-literal prefix /x/${id}.
 * Returns null if the value is not an absolute path.
 * Returns '' (empty string) for the root path '/'.
 */
export function firstSegment(value: string): string | null {
  if (!value.startsWith('/')) return null;

  const withoutLeading = value.slice(1);
  if (withoutLeading === '' || withoutLeading === '/') return ''; // root

  // Strip anything after the first /, ?, #, or $ (template expression start)
  const match = withoutLeading.match(/^([^/?#$`]+)/);
  return match ? match[1]! : '';
}

/**
 * Returns true if a literal value should be exempt from the deny-by-default
 * check (external URLs, anchors, API paths, or the root '/').
 */
export function isExemptLiteral(value: string): boolean {
  return (
    /^https?:\/\//i.test(value) || // absolute URL
    value.startsWith('//') || // protocol-relative
    /^mailto:/i.test(value) || // mailto
    /^tel:/i.test(value) || // tel
    value.startsWith('#') || // anchor
    value.startsWith('/api') || // internal API
    value === '/' // root
  );
}

// ---------------------------------------------------------------------------
// File collection
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Call-scoped scan patterns
// ---------------------------------------------------------------------------

/**
 * Matches a string or template literal starting with '/' as the first
 * argument to localePath/navigateTo/router.push/router.replace.
 *
 * Group 1 = the opening quote char (' " backtick), group 2 = path content.
 */
const NAV_CALL_PATTERN =
  /(?:localePath|navigateTo|router\.(?:push|replace))\(\s*(['"`])(\/[^'"`\s]*)/g;

/**
 * Matches a static (non-binding) to="/..." attribute on a component.
 * Note: :to="..." (dynamic binding) is intentionally NOT matched.
 *
 * Group 1 = path value (up to closing quote).
 */
const STATIC_TO_ATTR_PATTERN = /\bto="(\/[^"]+)"/g;

/**
 * Scan a single line for nav-call and static-attr literals beginning with '/'.
 * Returns the list of path values found.
 */
export function extractLineLiterals(line: string): string[] {
  const values: string[] = [];

  let m: RegExpExecArray | null;

  NAV_CALL_PATTERN.lastIndex = 0;
  while ((m = NAV_CALL_PATTERN.exec(line)) !== null) {
    values.push(m[2]!);
  }

  STATIC_TO_ATTR_PATTERN.lastIndex = 0;
  while ((m = STATIC_TO_ATTR_PATTERN.exec(line)) !== null) {
    values.push(m[1]!);
  }

  return values;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('cms-page-link literals deny-by-default guard', () => {
  // -------------------------------------------------------------------------
  // Layer B: current-tree scan
  // -------------------------------------------------------------------------

  it('should find zero hardcoded link literals in app/ whose first segment is not a real app route', () => {
    const allowlist = buildAllowlist(PAGES_DIR);
    const files = collectFiles(APP_DIR);
    const violations: string[] = [];

    for (const filePath of files) {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const literals = extractLineLiterals(line);

        for (const value of literals) {
          if (isExemptLiteral(value)) continue;

          const seg = firstSegment(value);
          if (seg === null) continue; // not an absolute path
          if (seg === '') continue; // root path, always allowed

          if (!allowlist.has(seg)) {
            const rel = relative(APP_DIR, filePath);
            violations.push(
              `  ${rel}:${i + 1} - first segment '${seg}' is not a real app route: ${line.trim()}`,
            );
          }
        }
      }
    }

    expect(
      violations,
      `Found ${violations.length} hardcoded link literal(s) whose first segment is not a real app route:\n` +
        `${violations.join('\n')}\n\n` +
        `Resolve CMS pages via useCmsPageLink(CMS_TAGS.X); ` +
        `if this is a new app route, it will be allowlisted automatically once app/pages has it.`,
    ).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Synthetic cases: deny-by-default behaviour
  // -------------------------------------------------------------------------

  it('flags localePath("/about") - not an app route', () => {
    const allowlist = new Set(['cart', 'portal', 'login', 'index']);
    const line = "const href = localePath('/about');";
    const literals = extractLineLiterals(line);
    const flagged = literals.filter((v) => {
      if (isExemptLiteral(v)) return false;
      const seg = firstSegment(v);
      if (seg === null || seg === '') return false;
      return !allowlist.has(seg);
    });
    expect(flagged).toContain('/about');
  });

  it('flags localePath("/terms") - semantic CMS slug is not an app route', () => {
    const allowlist = new Set(['cart', 'portal', 'login', 'index']);
    const line = "const href = localePath('/terms');";
    const literals = extractLineLiterals(line);
    const flagged = literals.filter((v) => {
      if (isExemptLiteral(v)) return false;
      const seg = firstSegment(v);
      if (seg === null || seg === '') return false;
      return !allowlist.has(seg);
    });
    expect(flagged).toContain('/terms');
  });

  it('does NOT flag localePath("/cart") - real app route', () => {
    const allowlist = new Set(['cart', 'portal', 'login', 'index']);
    const line = "router.push(localePath('/cart'));";
    const literals = extractLineLiterals(line);
    const flagged = literals.filter((v) => {
      if (isExemptLiteral(v)) return false;
      const seg = firstSegment(v);
      if (seg === null || seg === '') return false;
      return !allowlist.has(seg);
    });
    expect(flagged).not.toContain('/cart');
  });

  it('does NOT flag localePath("/portal/orders") - portal is a real app route', () => {
    const allowlist = new Set(['cart', 'portal', 'login', 'index']);
    const line = ':to="localePath(\'/portal/orders\')"';
    const literals = extractLineLiterals(line);
    const flagged = literals.filter((v) => {
      if (isExemptLiteral(v)) return false;
      const seg = firstSegment(v);
      if (seg === null || seg === '') return false;
      return !allowlist.has(seg);
    });
    expect(flagged).not.toContain('/portal/orders');
  });

  it('does NOT flag static localePath("/login") - real route', () => {
    const allowlist = new Set(['cart', 'portal', 'login', 'index']);
    const line = '      :to="localePath(\'/login\')"';
    const literals = extractLineLiterals(line);
    const flagged = literals.filter((v) => {
      if (isExemptLiteral(v)) return false;
      const seg = firstSegment(v);
      if (seg === null || seg === '') return false;
      return !allowlist.has(seg);
    });
    expect(flagged).not.toContain('/login');
  });

  it('flags "/terms-and-conditions" - not a real app route', () => {
    const allowlist = new Set(['cart', 'portal', 'login', 'index']);
    const line = "const href = localePath('/terms-and-conditions');";
    const literals = extractLineLiterals(line);
    const flagged = literals.filter((v) => {
      if (isExemptLiteral(v)) return false;
      const seg = firstSegment(v);
      if (seg === null || seg === '') return false;
      return !allowlist.has(seg);
    });
    expect(flagged).toContain('/terms-and-conditions');
  });

  it('does NOT flag external https:// URLs', () => {
    expect(isExemptLiteral('https://example.com/page')).toBe(true);
  });

  it('does NOT flag protocol-relative //cdn.example.com', () => {
    expect(isExemptLiteral('//cdn.example.com')).toBe(true);
  });

  it('does NOT flag mailto: links', () => {
    expect(isExemptLiteral('mailto:hello@example.com')).toBe(true);
  });

  it('does NOT flag tel: links', () => {
    expect(isExemptLiteral('tel:+46123456')).toBe(true);
  });

  it('does NOT flag anchor (#top)', () => {
    expect(isExemptLiteral('#top')).toBe(true);
  });

  it('does NOT flag /api/ paths', () => {
    expect(isExemptLiteral('/api/auth/login')).toBe(true);
  });

  // -------------------------------------------------------------------------
  // firstSegment edge cases
  // -------------------------------------------------------------------------

  it('extracts first segment from /x correctly', () => {
    expect(firstSegment('/cart')).toBe('cart');
  });

  it('extracts first segment from /x/ (trailing slash)', () => {
    expect(firstSegment('/portal/')).toBe('portal');
  });

  it('extracts first segment from /x?q=1 (query)', () => {
    expect(firstSegment('/search?q=boots')).toBe('search');
  });

  it('extracts first segment from /x#h (hash)', () => {
    expect(firstSegment('/cart#items')).toBe('cart');
  });

  it('extracts first segment from /portal/sub/path', () => {
    expect(firstSegment('/portal/orders/123')).toBe('portal');
  });

  it('returns empty string for root path "/"', () => {
    expect(firstSegment('/')).toBe('');
  });

  it('returns null for non-absolute paths', () => {
    expect(firstSegment('relative/path')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Allowlist self-maintenance
  // -------------------------------------------------------------------------

  it('adding a hypothetical route to the allowlist stops that literal being flagged', () => {
    const allowlist = new Set(['cart', 'portal', 'login', 'index']);
    const literal = '/about';
    const seg = firstSegment(literal);
    expect(seg).toBe('about');

    // Without 'about' in allowlist: flagged
    expect(allowlist.has(seg!)).toBe(false);

    // After adding: not flagged
    allowlist.add('about');
    expect(allowlist.has(seg!)).toBe(true);
  });

  it('derives allowlist from app/pages directory (real directory read)', () => {
    const allowlist = buildAllowlist(PAGES_DIR);
    // Known top-level real routes
    expect(allowlist.has('cart')).toBe(true);
    expect(allowlist.has('portal')).toBe(true);
    expect(allowlist.has('login')).toBe(true);
    expect(allowlist.has('checkout')).toBe(true);
    expect(allowlist.has('search')).toBe(true);
    expect(allowlist.has('products')).toBe(true);
    // Dynamic catch-all [...slug] must NOT be in allowlist
    expect(allowlist.has('[...slug]')).toBe(false);
    expect(allowlist.has('[...slug].vue')).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Layer A drift guard: every CMS_SEMANTIC_SLUG_KEYS entry in eslint.config.mjs
  // -------------------------------------------------------------------------

  it('eslint.config.mjs no-restricted-syntax selectors cover every CMS_SEMANTIC_SLUG_KEYS entry', () => {
    const eslintConfig = readFileSync(ESLINT_CONFIG, 'utf-8');
    const missing: string[] = [];

    for (const slug of CMS_SEMANTIC_SLUG_KEYS) {
      if (!eslintConfig.includes(slug)) {
        missing.push(slug);
      }
    }

    expect(
      missing,
      `The following CMS_SEMANTIC_SLUG_KEYS entries are missing from eslint.config.mjs no-restricted-syntax selectors:\n` +
        `  ${missing.join(', ')}\n\n` +
        `Add a no-restricted-syntax entry for each slug so the ESLint layer stays in sync with shared/constants/cms.ts.`,
    ).toHaveLength(0);
  });
});
