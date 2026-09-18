import type {
  Configuration,
  ConfigurationSection,
} from '#shared/types/configurator';
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

/**
 * The section tree the seeds do not have: three visible top-level sections, one
 * of them two levels deep, and a hidden section holding a visible child.
 *
 * The workbench nests `Finish` inside `Frame` and stops there, and the cabinet
 * has siblings and no depth at all. The rail is built from this tree, so it
 * needs a document where depth, document order and the hidden-parent case are
 * all present at once.
 *
 * Nothing new is invented: every group and variable below is one of the initial
 * document's, moved. A fixture that made up option rows would be a second
 * opinion about what a provider sends.
 */
export function makeSectionTreeConfiguration(
  overrides: Partial<Configuration> = {},
): Configuration {
  const config = makeInitialConfiguration();

  const frame = config.sections[0];
  const finish = frame?.sections[0];
  if (!frame || !finish) {
    throw new Error('The initial document lost its nested sections');
  }

  const section = (
    id: string,
    name: string,
    parts: Partial<ConfigurationSection> = {},
  ): ConfigurationSection => ({
    id,
    name,
    visible: true,
    sections: [],
    variables: [],
    optionGroups: [],
    messages: [],
    ...parts,
  });

  const industrial = findOptionGroup(config, 'industrial');
  const accessories = findOptionGroup(config, 'accessories');
  const shelves = findVariable(config, 'shelves');
  const oversize = findVariable(config, 'oversize');

  frame.optionGroups = frame.optionGroups.filter(
    (group) => group.id !== industrial.id,
  );
  frame.variables = frame.variables.filter(
    (variable) => variable.id !== shelves.id && variable.id !== oversize.id,
  );
  finish.optionGroups = finish.optionGroups.filter(
    (group) => group.id !== accessories.id,
  );

  // The grandchild, which is the entry the flattening has to reach.
  finish.sections = [
    section('edge-trim', 'Edge trim', { optionGroups: [industrial] }),
  ];

  config.sections = [
    frame,
    section('cable-mgmt', 'Cable management', {
      variables: [shelves, oversize],
    }),
    section('extras', 'Extras', { optionGroups: [accessories] }),
    // Hidden, and its child is visible: a rail that listed the child would show
    // a section whose messages the panel drops and whose requirements the
    // banner refuses to name.
    section('warehouse', 'Warehouse', {
      visible: false,
      sections: [section('pallet-store', 'Pallet store')],
    }),
  ];

  return { ...config, ...overrides };
}
