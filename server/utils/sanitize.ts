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

export function sanitizeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Validates and sanitizes a URL for use in HTML attributes.
 * Only allows https: URLs and data:image/ URIs (for favicons).
 * Returns null if the URL is invalid or uses a disallowed scheme.
 */
export function sanitizeUrl(url: string): string | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  // Allow https: and data:image/ only
  if (parsed.protocol === 'https:') {
    return sanitizeHtmlAttr(parsed.href);
  }

  if (parsed.protocol === 'data:' && url.startsWith('data:image/')) {
    return sanitizeHtmlAttr(url);
  }

  return null;
}

/**
 * Strips characters outside [a-zA-Z0-9 -] from a font family name
 * to prevent CSS injection when interpolating into CSS strings.
 */
export function escapeCssString(name: string): string {
  return name.replace(/[^a-zA-Z0-9 -]/g, '');
}
