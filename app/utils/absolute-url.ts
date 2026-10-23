/**
 * Prefixes an app path with the site URL: the tenant origin that site config
 * holds for the request. A URL that is already absolute, or a path with no
 * site URL to resolve against, is returned unchanged.
 */
export function toAbsoluteUrl(
  path: string,
  siteUrl: string | undefined,
): string {
  if (!siteUrl || /^[a-z][a-z\d+.-]*:\/\//i.test(path)) return path;
  const base = siteUrl.replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
