/**
 * Percent-encodes a path built from `event.path` for a Location header.
 *
 * h3 hands handlers and middleware the decoded path (`ö`, not `%C3%B6`), but
 * leaves `%2F` and `%25` encoded, so those are kept rather than encoded again.
 */
export function encodeRedirectPath(path: string): string {
  return encodeURI(path).replace(/%25([0-9A-F]{2})/gi, '%$1');
}
