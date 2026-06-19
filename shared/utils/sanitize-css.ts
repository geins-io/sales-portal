const SCRIPT_BLOCK_RE = /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi;
const HTML_TAG_RE = /<\/?[a-z][^>]*>/gi;
const AT_IMPORT_RE = /@import\b[^;]*;?/gi;
const AT_CHARSET_RE = /@charset\b[^;]*;?/gi;
const AT_NAMESPACE_RE = /@namespace\b[^;]*;?/gi;
const EXPRESSION_RE = /expression\s*\([^;{]*/gi;
const MOZ_BINDING_RE = /-moz-binding\s*:[^;]*(;|$)/gi;
const BEHAVIOR_RE = /behavior\s*:[^;]*(;|$)/gi;
const JAVASCRIPT_URI_RE = /javascript\s*:/gi;

const SAFE_URL_RE = /^(https:|data:image\/)/i;
const URL_QUOTED_RE = /url\s*\(\s*(['"])([^'"]*)\1\s*\)/gi;

function stripUnsafeUnquotedUrls(css: string): string {
  const urlStart = /url\s*\(/gi;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = urlStart.exec(css)) !== null) {
    const startIdx = match.index;
    const openParenIdx = match.index + match[0].length;

    // Check if this is a quoted url (already handled)
    const afterOpen = css.slice(openParenIdx).trimStart();
    if (afterOpen[0] === '"' || afterOpen[0] === "'") continue;

    // Find matching closing paren
    let depth = 1;
    let i = openParenIdx;
    while (i < css.length && depth > 0) {
      if (css[i] === '(') depth++;
      else if (css[i] === ')') depth--;
      i++;
    }

    const uri = css.slice(openParenIdx, i - 1).trim();
    if (SAFE_URL_RE.test(uri)) continue;

    // Unsafe: splice it out
    result += css.slice(lastIndex, startIdx);
    lastIndex = i;
  }

  result += css.slice(lastIndex);
  return result;
}

/**
 * Strips dangerous constructs from a tenant CSS string before it is injected
 * into a `<style>` tag. Removes inline HTML/script (so an admin override
 * cannot break out of the style element), `@import`/`@charset`/`@namespace`
 * at-rules, IE `expression()`, `-moz-binding`, `behavior`, `javascript:` URIs,
 * and any `url()` whose target is not an `https:` or `data:image/` resource.
 *
 * Lives in `shared/` so both the Nitro `render:html` plugin and the client
 * error page can apply the exact same hardening to the same css string.
 */
export function sanitizeTenantCss(css: string): string {
  let result = css;

  result = result.replace(SCRIPT_BLOCK_RE, '');
  result = result.replace(HTML_TAG_RE, '');
  result = result.replace(AT_IMPORT_RE, '');
  result = result.replace(AT_CHARSET_RE, '');
  result = result.replace(AT_NAMESPACE_RE, '');
  result = result.replace(EXPRESSION_RE, '');
  result = result.replace(MOZ_BINDING_RE, '');
  result = result.replace(BEHAVIOR_RE, '');

  // Filter quoted url() values
  result = result.replace(URL_QUOTED_RE, (match, _quote, uri) => {
    if (SAFE_URL_RE.test(uri.trim())) return match;
    return '';
  });

  // Filter unquoted url() values (handles nested parens)
  result = stripUnsafeUnquotedUrls(result);

  result = result.replace(JAVASCRIPT_URI_RE, '');

  return result.trim();
}
