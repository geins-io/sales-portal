import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * The one place the e2e suite reads its environment, and the one place the
 * committed target is spelled out.
 *
 * Plain ESM rather than TypeScript because `infra/scripts/local-dev.sh` runs
 * this file with node to learn which hostname a run targets, and Node 20 —
 * CI's version and this package's floor — cannot load a `.ts` file.
 * `tests/e2e/target.ts` re-exports everything below with types; the specs and
 * `playwright.config.ts` import that.
 *
 * Values come from the gitignored `.env` locally and from repository variables
 * and secrets in CI.
 */

// `quiet`: dotenv's banner goes to stdout and corrupts --reporter=json.
dotenv.config({
  path: resolve(import.meta.dirname, '../../.env'),
  quiet: true,
});

/** The tenant `/api/config` must resolve to. */
const DEFAULT_TENANT_ID = 'sonoralab';

/**
 * The host under test, in every mode. The dnsmasq wildcard sends all of
 * `*.litium.portal` to 127.0.0.1 and the server looks the tenant up under
 * `.litium.store` (`server/utils/lookup-hostname.ts`), so a run needs nothing
 * configured on the machine — no `/etc/hosts` line, and no name that could
 * resolve to a deployed environment by accident.
 *
 * Spelled out rather than derived from the tenant id: the next tenant need not
 * follow the pattern, and the name stays greppable.
 */
const DEFAULT_HOST = 'sonoralab.litium.portal';

const DEFAULT_PORT = 3000;

/** CI always runs the production build; locally E2E_PROD=1 opts into it. */
export const PRODUCTION_BUILD = !!(process.env.CI || process.env.E2E_PROD);

/** The target is already running; Playwright starts no server. */
export const EXTERNAL_SERVER = !!process.env.E2E_EXTERNAL_SERVER;

/**
 * The target is a deployed environment on purpose, so L0's locality check
 * stands down. Without it, a target that resolves off this machine fails the
 * run rather than testing something nobody meant to test.
 */
export const REMOTE_TARGET = !!process.env.E2E_REMOTE;

/** Origin under test. The dev server is http, the production build https. */
export const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ||
  `${PRODUCTION_BUILD ? 'https' : 'http'}://${DEFAULT_HOST}:${DEFAULT_PORT}`;

/** The tenant `/api/config` must resolve for that origin. */
export const EXPECTED_TENANT_ID =
  process.env.E2E_EXPECTED_TENANT_ID || DEFAULT_TENANT_ID;

/** Test-account credentials. Auth-dependent specs are out of scope without them. */
export const e2eCredentials = {
  username: process.env.E2E_USERNAME ?? '',
  password: process.env.E2E_PASSWORD ?? '',
};

/** @returns {boolean} */
export function hasE2ECredentials() {
  return !!(e2eCredentials.username && e2eCredentials.password);
}

/**
 * The hostname a run targets. Read by `infra/scripts/local-dev.sh` for its DNS
 * check and its "access the app at" lines.
 *
 * @returns {string}
 */
export function targetHostname() {
  return new URL(BASE_URL).hostname;
}

/**
 * Whether an address from `dns.lookup` is this machine: 127.0.0.0/8, `::1`, or
 * either written as an IPv4-mapped IPv6 address. Anything else means the
 * target is somewhere on the network.
 *
 * @param {string} address
 * @returns {boolean}
 */
export function isLoopbackAddress(address) {
  const addr = address.trim().toLowerCase().split('%')[0] ?? '';
  // `::ffff:127.0.0.1` is the same machine written the long way.
  const mapped = addr.startsWith('::ffff:')
    ? addr.slice('::ffff:'.length)
    : addr;

  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(mapped)) return true;
  return mapped === '::1' || /^(?:0{1,4}:){7}0{0,3}1$/.test(mapped);
}

// Run directly (infra/scripts/local-dev.sh): print the target hostname and
// nothing else.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  console.log(targetHostname());
}
