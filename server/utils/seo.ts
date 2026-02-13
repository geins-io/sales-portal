/**
 * Builds the canonical site URL from a hostname.
 */
export function buildSiteUrl(hostname: string): string {
  return `https://${hostname}`;
}

/**
 * Determines if the site should be indexable based on the robots string.
 * Returns false if robots contains 'noindex', true otherwise.
 */
export function isIndexable(robots?: string | null): boolean {
  if (!robots) return true;
  return !robots.toLowerCase().includes('noindex');
}
