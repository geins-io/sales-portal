import type { Configuration } from '#shared/types/configurator';
import { findOptionGroup, findVariable } from './builders';
import { makeInitialConfiguration } from './initial';

// ---------------------------------------------------------------------------
// Derived documents, not seeded ones.
//
// `ConfigurationValueType` has four members and no seeded product uses
// `boolean` or `date`: the workbench is all numbers and the cabinet adds one
// string. A form component still has to render both, so these two documents
// retype a named variable of the initial document the way `cascaded` and
// `invalid` change named nodes of it.
//
// They describe nothing about the contract and nothing about what a provider
// returns — the file is called `derived` so no spec mistakes them for either.
// They go away the day a seed has a checkbox or a delivery date on it.
// ---------------------------------------------------------------------------

/** `shelves` retyped: a count nobody would model as a flag, but the shape fits. */
export function makeBooleanVariableConfiguration(
  overrides: Partial<Configuration> = {},
): Configuration {
  const config = makeInitialConfiguration();

  const shelves = findVariable(config, 'shelves');
  shelves.valueType = 'boolean';
  shelves.value = false;
  shelves.defaultValue = false;
  shelves.min = undefined;
  shelves.max = undefined;
  shelves.step = undefined;
  shelves.unit = undefined;

  return { ...config, ...overrides };
}

/** The same variable as a date, so one spec can address one id for both. */
export function makeDateVariableConfiguration(
  overrides: Partial<Configuration> = {},
): Configuration {
  const config = makeInitialConfiguration();

  const shelves = findVariable(config, 'shelves');
  shelves.valueType = 'date';
  // A full ISO timestamp rather than a bare date: that is what the contract
  // says arrives, and a date input cannot show it unchanged.
  shelves.value = '2026-09-17T00:00:00.000Z';
  shelves.defaultValue = null;
  shelves.min = undefined;
  shelves.max = undefined;
  shelves.step = undefined;
  shelves.unit = undefined;

  return { ...config, ...overrides };
}

/**
 * `industrial` moved inside `legs`. `ConfigurationOptionGroup` nests and the
 * form renders that nesting, but no seeded product has a group inside a group,
 * so the recursion has nothing else to run against.
 */
export function makeNestedGroupConfiguration(
  overrides: Partial<Configuration> = {},
): Configuration {
  const config = makeInitialConfiguration();

  const frame = config.sections[0];
  if (!frame) throw new Error('The initial document lost its first section');

  const industrial = findOptionGroup(config, 'industrial');
  frame.optionGroups = frame.optionGroups.filter(
    (group) => group.id !== industrial.id,
  );
  findOptionGroup(config, 'legs').optionGroups = [industrial];

  return { ...config, ...overrides };
}
