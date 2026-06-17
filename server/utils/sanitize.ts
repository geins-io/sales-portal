// `sanitizeTenantCss` lives in `#shared/utils/sanitize-css` so the client error
// page can harden the same tenant css string the server plugin injects.

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
