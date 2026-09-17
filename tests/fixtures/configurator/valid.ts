import type { Configuration } from '#shared/types/configurator';
import { findOption, findOptionGroup } from './builders';
import { makeInitialConfiguration } from './initial';

// ---------------------------------------------------------------------------
// The initial document with the one thing that makes it invalid resolved: a
// colour picked, the group's error gone, `isValid` true.
//
// A document of its own because `makeInitialConfiguration()` is invalid by
// design and stays that way — the made-to-order finish has no default in the
// seed, and that unmet `minSelections: 1` is the point of it. Anything that
// needs a complete configuration has to build one.
//
// Black is picked because its delta is 0, so the price stays the base price
// and a consumer comparing the two documents sees only the validity change.
// ---------------------------------------------------------------------------

export function makeValidConfiguration(
  overrides: Partial<Configuration> = {},
): Configuration {
  const config = makeInitialConfiguration();

  const black = findOption(config, 'ral-9005');
  black.selected = true;
  black.selectionSource = 'manual';

  findOptionGroup(config, 'color').messages = [];

  return { ...config, isValid: true, ...overrides };
}
