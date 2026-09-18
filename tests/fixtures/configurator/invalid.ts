import type { Configuration } from '#shared/types/configurator';
import { findOption } from './builders';
import { makeInitialConfiguration } from './initial';

// ---------------------------------------------------------------------------
// The initial document with the required table-top group emptied by hand.
//
// Two required groups are empty here — the colour group was already empty on
// create. That is the point: the document shows what an incomplete
// configuration looks like, not a single defect. What makes it incomplete is
// the unmet `minSelections` on both, which is where the engine puts that fact;
// no message is written for it, so a consumer that reads one finds nothing.
// ---------------------------------------------------------------------------

export function makeInvalidConfiguration(
  overrides: Partial<Configuration> = {},
): Configuration {
  const config = makeInitialConfiguration();

  const topLaminate = findOption(config, 'top-laminate');
  topLaminate.selected = false;
  // A deselection never reports as manual; the row returns to the value it
  // was created with. Measured against a live install.
  topLaminate.selectionSource = 'initial';

  return { ...config, ...overrides };
}
