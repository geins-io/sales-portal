import dotenv from 'dotenv';
import { resolve } from 'node:path';

/**
 * The one place the e2e suite reads its environment. Imported by
 * playwright.config.ts and the specs alike, so it carries no Playwright
 * imports. Values come from the gitignored .env locally and from repository
 * variables and secrets in CI; the committed defaults name tenant-a.
 */

// `quiet`: dotenv's banner goes to stdout and corrupts --reporter=json.
dotenv.config({
  path: resolve(import.meta.dirname, '../../.env'),
  quiet: true,
});

/** CI always runs the production build; locally E2E_PROD=1 opts into it. */
export const PRODUCTION_BUILD = !!(process.env.CI || process.env.E2E_PROD);

/** The target is already running; Playwright starts no server. */
export const EXTERNAL_SERVER = !!process.env.E2E_EXTERNAL_SERVER;

const DEFAULT_HOST = 'tenant-a.litium.portal';
const DEFAULT_PORT = 3000;

/** Origin under test. The dev server is http, the production build https. */
export const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ||
  `${PRODUCTION_BUILD ? 'https' : 'http'}://${DEFAULT_HOST}:${DEFAULT_PORT}`;

/** The tenant `/api/config` must resolve for that origin. */
export const EXPECTED_TENANT_ID =
  process.env.E2E_EXPECTED_TENANT_ID || 'tenant-a';

/** Test-account credentials. Auth-dependent specs are out of scope without them. */
export const e2eCredentials = {
  username: process.env.E2E_USERNAME ?? '',
  password: process.env.E2E_PASSWORD ?? '',
};

export function hasE2ECredentials(): boolean {
  return !!(e2eCredentials.username && e2eCredentials.password);
}
