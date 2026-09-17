import type { Configuration } from '#shared/types/configurator';
import { createSessionState, evaluate } from '../evaluate';
import {
  arbetsbordPro,
  ARBETSBORD_PRO_GEINS_ID,
  ARBETSBORD_PRO_ID,
} from './arbetsbord-pro';
import {
  skapsektionPro,
  SKAPSEKTION_PRO_GEINS_ID,
  SKAPSEKTION_PRO_ID,
} from './skapsektion-pro';
import type { Seed } from './types';

// ---------------------------------------------------------------------------
// The products the fixture sells.
//
// They live under the engine rather than in `tests/` because server code cannot
// import from there, and because a seed is the fixture's catalogue, not test
// data. The test fixtures derive their example documents from this module, so
// there is one Arbetsbord Pro in the repo and not two.
// ---------------------------------------------------------------------------

export {
  ARBETSBORD_PRO_GEINS_ID,
  ARBETSBORD_PRO_ID,
  SKAPSEKTION_PRO_GEINS_ID,
  SKAPSEKTION_PRO_ID,
};
export type { Seed };

const SEEDS: Seed[] = [arbetsbordPro, skapsektionPro];

/**
 * Resolved by the Geins product id the seed declares, never by the provider's
 * part id: the portal asks for the catalogue product it knows.
 */
export function findSeed(geinsProductId: string): Seed | undefined {
  return SEEDS.find((seed) => seed.geinsProductId === geinsProductId);
}

/**
 * The document a product starts as, with nothing chosen. The session identity
 * is passed in: a caller that is not a session — an example document in a test
 * — pins both fields, and the engine has no business inventing them here.
 */
export function createSeedDocument(
  geinsProductId: string,
  session: { configurationId: string; expiresAt: string },
  quantity = 1,
): Configuration {
  const seed = findSeed(geinsProductId);
  if (!seed) throw new Error(`No seeded product '${geinsProductId}'`);
  return evaluate(seed, createSessionState(quantity), session);
}
