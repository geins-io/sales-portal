import type { Configuration } from '#shared/types/configurator';
import {
  ARBETSBORD_PRO_ID,
  createSeedDocument,
} from '../../../server/services/configurator-fixture/seed';

// ---------------------------------------------------------------------------
// "Arbetsbord Pro" as the configurator returns it on create: article KONF-1001,
// base price 3200, four variables and five option groups including the
// 26-option RAL colour group, in two nested sections (Frame holds the
// variables, Finish nests inside it). The steel-top rule therefore narrows a
// variable in the parent section from a group in the child one, which is the
// cascade shape the UI has to survive.
//
// The document is the fixture engine's own seed rather than a second copy of
// it: one Arbetsbord Pro in the repo, and these example documents fail the day
// the engine's shape drifts from what the specs below assume.
//
// The colour group arrives empty: a made-to-order finish has no default in the
// seed, and that unmet `minSelections: 1` is what makes a fresh document
// invalid. It stays empty in all three documents.
//
// Prices are the mock's arithmetic (base + option delta + variable
// delta-from-default). The real provider computes a multiplicative formula
// server-side, so nothing about these numbers describes the contract and no
// test pinning them may be named like a contract test.
//
// Ids are the seed's slugs, readable on purpose. A real provider's ids are
// opaque numeric strings — nothing may parse them.
// ---------------------------------------------------------------------------

export const BASE_PRICE = 3200;

/**
 * Far in the future so nothing that checks liveness has to fake a clock. A
 * test for the expired-session path overrides it. Pinned here rather than taken
 * from the engine's clock so that two calls compare equal.
 */
export const EXPIRES_AT = '2030-01-01T00:00:00.000Z';

const CONFIGURATION_ID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

export function makeInitialConfiguration(
  overrides: Partial<Configuration> = {},
): Configuration {
  return {
    ...createSeedDocument(ARBETSBORD_PRO_ID, {
      configurationId: CONFIGURATION_ID,
      expiresAt: EXPIRES_AT,
    }),
    ...overrides,
  };
}
