import type { Configuration } from '#shared/types/configurator';
import {
  createSeedDocument,
  SKAPSEKTION_PRO_ID,
} from '../../../server/services/configurator-fixture/seed';

// ---------------------------------------------------------------------------
// "Skåpsektion Pro" as the configurator returns it on create: article
// KONF-1002, two sections, one of which arrives invisible.
//
// It is here for the three states the workbench never reaches, all of them
// seeded rather than derived:
//
//   logistics    -> a section with `visible: false`, holding a `string` variable
//   front-area   -> a variable the provider computes, `selectionSource: locked`
//   mount-wall   -> a row selected and locked, with the reason on it
//
// Built from the engine's own seed for the same reason `initial` is: one
// Skåpsektion Pro in the repo, and this document fails the day the seed's
// shape drifts from what a spec assumes.
// ---------------------------------------------------------------------------

/** Far in the future, for the same reason `initial` pins its own. */
export const CABINET_EXPIRES_AT = '2030-01-01T00:00:00.000Z';

const CONFIGURATION_ID = '3f2504e0-4f89-11d3-9a0c-0305e82c3302';

export function makeCabinetConfiguration(
  overrides: Partial<Configuration> = {},
): Configuration {
  return {
    ...createSeedDocument(SKAPSEKTION_PRO_ID, {
      configurationId: CONFIGURATION_ID,
      expiresAt: CABINET_EXPIRES_AT,
    }),
    ...overrides,
  };
}
