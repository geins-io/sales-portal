import * as target from './target-defaults.mjs';

/**
 * The typed surface of the e2e target. Everything is resolved in
 * `./target-defaults.mjs` — plain ESM so `infra/scripts/local-dev.sh` can run
 * it with node — and re-exported here with explicit types, which is what the
 * specs and `playwright.config.ts` import.
 */

/** CI always runs the production build; locally E2E_PROD=1 opts into it. */
export const PRODUCTION_BUILD: boolean = target.PRODUCTION_BUILD;

/** The target is already running; Playwright starts no server. */
export const EXTERNAL_SERVER: boolean = target.EXTERNAL_SERVER;

/** E2E_REMOTE=1: the target is a deployed environment on purpose. */
export const REMOTE_TARGET: boolean = target.REMOTE_TARGET;

/** Origin under test. The dev server is http, the production build https. */
export const BASE_URL: string = target.BASE_URL;

/** The tenant `/api/config` must resolve for that origin. */
export const EXPECTED_TENANT_ID: string = target.EXPECTED_TENANT_ID;

/** Test-account credentials. Auth-dependent specs are out of scope without them. */
export const e2eCredentials: { username: string; password: string } =
  target.e2eCredentials;

export const hasE2ECredentials: () => boolean = target.hasE2ECredentials;

/** The hostname that needs an `/etc/hosts` line pointing at 127.0.0.1. */
export const productionTargetHostname: () => string =
  target.productionTargetHostname;

/** Whether an address from `dns.lookup` is this machine. */
export const isLoopbackAddress: (address: string) => boolean =
  target.isLoopbackAddress;
