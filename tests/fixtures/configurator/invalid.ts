import type { Configuration } from '#shared/types/configurator';
import { findOption, findOptionGroup } from './builders';
import { makeInitialConfiguration } from './initial';

// ---------------------------------------------------------------------------
// The initial document with the required table-top group emptied by hand. The
// error sits on the group, not on the root and not on the section: the
// provider has no source for messages at those levels, so a consumer that
// reads them there finds nothing.
//
// Two required groups are empty here — the colour group was already empty on
// create — and both carry their own error. That is the point: the document
// shows what an incomplete configuration looks like, not a single defect.
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

  findOptionGroup(config, 'top').messages = [
    { severity: 'error', text: 'Select a table top.' },
  ];

  return { ...config, ...overrides };
}
