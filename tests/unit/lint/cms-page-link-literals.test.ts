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
 * Call-scoped: only localePath/navigateTo/router.push/router.replace/
 * useRouter().push/useRouter().replace first args, bound :to/:href literals,
 * navigateTo object path/to properties, and static to="/..." attributes are
 * scanned. Code comments and JSDoc examples are not matched.
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
 * argument to localePath/navigateTo/router.push/router.replace or
 * the inline useRouter().push/useRouter().replace form (B3).
 *
 * Group 1 = the opening quote char (' " backtick), group 2 = path content.
 */
const NAV_CALL_PATTERN =
  /(?:localePath|navigateTo|(?:router|useRouter\(\))\.(?:push|replace))\(\s*(['"`])(\/[^'"`\s]*)/g;

/**
 * Matches a static (non-binding) to="/..." attribute on a component.
 * Note: :to="..." (dynamic binding) is matched separately by BOUND_ATTR_PATTERN.
 *
 * Group 1 = path value (up to closing quote).
 */
const STATIC_TO_ATTR_PATTERN = /\bto="(\/[^"]+)"/g;

/**
 * Matches a bound :to or :href directive containing a literal string or
 * template literal (B2). Covers:
 *   :to="'/terms'"          (single-quoted string inside double-quoted binding)
 *   :to='"/terms"'          (double-quoted string inside single-quoted binding)
 *   :href="'/apply'"
 *
 * Group 1 = the inner quote char, group 2 = path content.
 *
 * Note: backtick template literals inside bindings (:to="`/terms`") are not
 * trivially catchable by a line-level regex (backtick nesting ambiguity);
 * those are caught by the Layer A vue/no-restricted-syntax rule instead.
 */
const BOUND_ATTR_PATTERN =
  /:(?:to|href)=["']\s*(['"])(\/[^'"`\s]*)/g;

/**
 * Matches the path or to property value inside a navigateTo({ ... }) object
 * expression (B4). Covers navigateTo({ path: '/terms' }) and
 * navigateTo({ to: '/terms' }).
 *
 * Group 1 = path value.
 */
const NAVIGATE_TO_OBJECT_PATTERN =
  /navigateTo\(\s*\{[^}]*\b(?:path|to)\s*:\s*(['"`])(\/[^'"`\s]*)/g;

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

  BOUND_ATTR_PATTERN.lastIndex = 0;
  while ((m = BOUND_ATTR_PATTERN.exec(line)) !== null) {
    values.push(m[2]!);
  }

  NAVIGATE_TO_OBJECT_PATTERN.lastIndex = 0;
  while ((m = NAVIGATE_TO_OBJECT_PATTERN.exec(line)) !== null) {
    values.push(m[2]!);
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
  // B2: bound :to/:href literal bypass patterns (new in adversarial hardening)
  // -------------------------------------------------------------------------

  it('B2: flags :to="\'about\'" bound attribute literal - not an app route', () => {
    const allowlist = new Set(['cart', 'portal', 'login', 'index']);
    const line = "<NuxtLink :to=\"'/about'\">About</NuxtLink>";
    const literals = extractLineLiterals(line);
    const flagged = literals.filter((v) => {
      if (isExemptLiteral(v)) return false;
      const seg = firstSegment(v);
      if (seg === null || seg === '') return false;
      return !allowlist.has(seg);
    });
    expect(flagged).toContain('/about');
  });

  it('B2: flags :href="\'about\'" bound attribute literal - not an app route', () => {
    const allowlist = new Set(['cart', 'portal', 'login', 'index']);
    const line = "<a :href=\"'/about'\">About</a>";
    const literals = extractLineLiterals(line);
    const flagged = literals.filter((v) => {
      if (isExemptLiteral(v)) return false;
      const seg = firstSegment(v);
      if (seg === null || seg === '') return false;
      return !allowlist.has(seg);
    });
    expect(flagged).toContain('/about');
  });

  it('B2: does NOT flag :to="\'cart\'" - real app route', () => {
    const allowlist = new Set(['cart', 'portal', 'login', 'index']);
    const line = "<NuxtLink :to=\"'/cart'\">Cart</NuxtLink>";
    const literals = extractLineLiterals(line);
    const flagged = literals.filter((v) => {
      if (isExemptLiteral(v)) return false;
      const seg = firstSegment(v);
      if (seg === null || seg === '') return false;
      return !allowlist.has(seg);
    });
    expect(flagged).not.toContain('/cart');
  });

  // B3: useRouter().push/replace bypass
  it('B3: flags useRouter().push("/about") - not an app route', () => {
    const allowlist = new Set(['cart', 'portal', 'login', 'index']);
    const line = "useRouter().push('/about');";
    const literals = extractLineLiterals(line);
    const flagged = literals.filter((v) => {
      if (isExemptLiteral(v)) return false;
      const seg = firstSegment(v);
      if (seg === null || seg === '') return false;
      return !allowlist.has(seg);
    });
    expect(flagged).toContain('/about');
  });

  it('B3: flags useRouter().replace("/about") - not an app route', () => {
    const allowlist = new Set(['cart', 'portal', 'login', 'index']);
    const line = "useRouter().replace('/about');";
    const literals = extractLineLiterals(line);
    const flagged = literals.filter((v) => {
      if (isExemptLiteral(v)) return false;
      const seg = firstSegment(v);
      if (seg === null || seg === '') return false;
      return !allowlist.has(seg);
    });
    expect(flagged).toContain('/about');
  });

  it('B3: does NOT flag useRouter().push("/cart") - real app route', () => {
    const allowlist = new Set(['cart', 'portal', 'login', 'index']);
    const line = "useRouter().push('/cart');";
    const literals = extractLineLiterals(line);
    const flagged = literals.filter((v) => {
      if (isExemptLiteral(v)) return false;
      const seg = firstSegment(v);
      if (seg === null || seg === '') return false;
      return !allowlist.has(seg);
    });
    expect(flagged).not.toContain('/cart');
  });

  it('B3: does NOT flag useRouter().push("/portal") - real app route', () => {
    const allowlist = new Set(['cart', 'portal', 'login', 'index']);
    const line = "useRouter().push('/portal');";
    const literals = extractLineLiterals(line);
    const flagged = literals.filter((v) => {
      if (isExemptLiteral(v)) return false;
      const seg = firstSegment(v);
      if (seg === null || seg === '') return false;
      return !allowlist.has(seg);
    });
    expect(flagged).not.toContain('/portal');
  });

  // B4: navigateTo({ path: '/terms' }) object form
  it('B4: flags navigateTo({ path: "/about" }) - not an app route', () => {
    const allowlist = new Set(['cart', 'portal', 'login', 'index']);
    const line = "navigateTo({ path: '/about' });";
    const literals = extractLineLiterals(line);
    const flagged = literals.filter((v) => {
      if (isExemptLiteral(v)) return false;
      const seg = firstSegment(v);
      if (seg === null || seg === '') return false;
      return !allowlist.has(seg);
    });
    expect(flagged).toContain('/about');
  });

  it('B4: does NOT flag navigateTo({ path: "/cart" }) - real app route', () => {
    const allowlist = new Set(['cart', 'portal', 'login', 'index']);
    const line = "navigateTo({ path: '/cart' });";
    const literals = extractLineLiterals(line);
    const flagged = literals.filter((v) => {
      if (isExemptLiteral(v)) return false;
      const seg = firstSegment(v);
      if (seg === null || seg === '') return false;
      return !allowlist.has(seg);
    });
    expect(flagged).not.toContain('/cart');
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
  // N2: word-bounded matching and bidirectional check
  // -------------------------------------------------------------------------

  it('N2: eslint.config.mjs selectors contain each CMS_SEMANTIC_SLUG_KEYS entry as a word-bounded token', () => {
    const eslintConfig = readFileSync(ESLINT_CONFIG, 'utf-8');
    const missing: string[] = [];

    for (const slug of CMS_SEMANTIC_SLUG_KEYS) {
      // Word-bounded: the slug must appear as a whole word inside a selector
      // alternation (e.g. contact-form in `contact-form|contact|...`).
      // A simple substring check passes even when the standalone alternation
      // is dropped but the slug appears inside a longer alternation arm.
      // The regex word-boundary \b is not useful for slugs with hyphens, so
      // we match on alternation delimiters (|, (, )) and the end/start of the
      // slug token which is unambiguous in the CSS-selector alternation syntax.
      const wordBounded = new RegExp(
        '(?:^|[|(?:])' + slug.replace(/-/g, '\\-') + '(?:[|):]|$)',
      );
      if (!wordBounded.test(eslintConfig)) {
        missing.push(slug);
      }
    }

    expect(
      missing,
      `The following CMS_SEMANTIC_SLUG_KEYS entries are missing as standalone tokens in eslint.config.mjs no-restricted-syntax selectors:\n` +
        `  ${missing.join(', ')}\n\n` +
        `Add a no-restricted-syntax entry for each slug so the ESLint layer stays in sync with shared/constants/cms.ts.`,
    ).toHaveLength(0);
  });

  it('N2: every slug alternation in eslint.config.mjs resolves to a CMS_SEMANTIC_SLUG_KEYS entry (reverse check)', () => {
    const eslintConfig = readFileSync(ESLINT_CONFIG, 'utf-8');
    // Extract the slug alternation from the regex patterns in the config.
    // The alternation uses the form: (?:contact-form|contact|apply-for-account|apply|terms)
    const altMatch = eslintConfig.match(
      /\(\?:([^)]+)\)(?:\(\[\/\?#\]\|\$\))/,
    );
    if (!altMatch) {
      // If the alternation pattern can't be found, skip the reverse check
      // (the forward check above is authoritative; this is defense-in-depth).
      return;
    }
    const slugsInConfig = altMatch[1]!.split('|');
    const keySet = new Set(CMS_SEMANTIC_SLUG_KEYS);
    const unknown = slugsInConfig.filter((s) => !keySet.has(s));
    expect(
      unknown,
      `The following slugs are in eslint.config.mjs alternations but NOT in CMS_SEMANTIC_SLUG_KEYS:\n` +
        `  ${unknown.join(', ')}\n\n` +
        `Remove stale entries from the ESLint selector alternation or add them to shared/constants/cms.ts.`,
    ).toHaveLength(0);
  });
});
