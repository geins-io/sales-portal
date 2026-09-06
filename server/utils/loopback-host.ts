/**
 * The hostnames that name this machine rather than a tenant. Matched in
 * full: `test.localhost` is an ordinary tenant hostname, so a suffix match
 * would swallow names a developer may legitimately register.
 */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * Whether the browser asked for the server itself instead of naming a tenant.
 *
 * Takes the raw Host header, not the value `normalizeHostname` produces: that
 * one splits on `:` and keeps the first field, which turns the IPv6 literal
 * `[::1]:3000` into `[`. Here the brackets delimit the address, so the port is
 * dropped after them and the brackets go with it.
 */
export function isLoopbackHost(rawHostname: string): boolean {
  let host = rawHostname;
  if (host.startsWith('[')) {
    const end = host.indexOf(']');
    if (end === -1) return false;
    host = host.slice(1, end);
  } else {
    host = host.split(':')[0] ?? host;
  }
  return LOOPBACK_HOSTS.has(host.toLowerCase());
}
