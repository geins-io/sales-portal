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
 * Whether a change picks again the one row a single choice already holds, so
 * there is nothing to send. A quantity is a real change, and a group holding
 * two rows still gets the replace batch, which repairs it.
 */
export function repicksTheChoice(
  group: Pick<ConfigurationOptionGroup, 'maxSelections' | 'options'>,
  change: ConfigurationChange,
): boolean {
  if (!isSingleSelect(group)) return false;
  if (change.type !== 'option' || !change.selected) return false;
  if (change.quantity !== undefined) return false;
  const [only, ...others] = group.options.filter((option) => option.selected);
  return (
    !others.length &&
    only?.id === change.optionId &&
    only.instanceId === change.instanceId
  );
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
    ...others.map((option): ConfigurationChange => ({
      type: 'option',
      optionId: option.id,
      instanceId: option.instanceId,
      selected: false,
      lock: 'none',
    })),
    pick,
  ];
}
