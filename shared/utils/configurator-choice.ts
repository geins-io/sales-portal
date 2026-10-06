import type {
  ConfigurationChange,
  ConfigurationOption,
  ConfigurationOptionGroup,
} from '#shared/types/configurator';

// ---------------------------------------------------------------------------
// What a buyer's choice in an option group sends, shared by the form and by the
// replay of an order row: one rule for which rows the provider lets go and for
// how a single choice replaces another.
// ---------------------------------------------------------------------------

/**
 * The provider refuses the buyer's change to the row. `locked` is not that: it
 * says why a row is selected, and the provider takes the buyer's change to it.
 */
export function isOptionReadOnly(
  option: Pick<ConfigurationOption, 'readOnly'>,
): boolean {
  return option.readOnly;
}

/** An absent `maxSelections` is an unbounded group, not a single-choice one. */
export function isSingleSelect(
  group: Pick<ConfigurationOptionGroup, 'maxSelections'>,
): boolean {
  return group.maxSelections === 1;
}

/**
 * A pick in a single-choice group as one batch: every other chosen row out
 * first, then the pick. The provider does not release a locked row for a
 * sibling pick, and applies a batch in order. A row it refuses to change is
 * left to it.
 */
export function singleChoiceChanges(
  group: Pick<ConfigurationOptionGroup, 'options'>,
  pick: Extract<ConfigurationChange, { type: 'option' }>,
): ConfigurationChange[] {
  const others = group.options.filter(
    (option) =>
      option.selected &&
      !isOptionReadOnly(option) &&
      !(option.id === pick.optionId && option.instanceId === pick.instanceId),
  );
  return [
    ...others.map(
      (option): ConfigurationChange => ({
        type: 'option',
        optionId: option.id,
        instanceId: option.instanceId,
        selected: false,
        lock: 'none',
      }),
    ),
    pick,
  ];
}
