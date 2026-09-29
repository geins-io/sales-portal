import type {
  ConfigurationChange,
  ConfigurationMessage,
  ConfigurationOption,
  ConfigurationOptionGroup,
  ConfigurationValue,
  ConfigurationVariable,
} from '#shared/types/configurator';
import { formatPrice } from '#shared/types/commerce';

// ---------------------------------------------------------------------------
// The decisions the configurator form makes about a document node.
//
// They live in a .ts rather than in the components that use them because
// Stryker instruments a file before the Vue compiler runs and so produces no
// mutants for a .vue: a rule that only exists in a template is a rule nothing
// verifies.
// ---------------------------------------------------------------------------

/** The control a variable renders as. `text` covers the `string` value type. */
export type VariableControl = 'number' | 'text' | 'boolean' | 'date';

export function variableControl(
  variable: Pick<ConfigurationVariable, 'valueType'>,
): VariableControl {
  switch (variable.valueType) {
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'date';
    case 'string':
      return 'text';
  }
}

/**
 * The provider owns the value and the buyer may not change it. Both sources
 * mean the same thing to the UI; only the provider knows which one it is.
 */
export function isReadOnly(
  node: Pick<
    ConfigurationOption | ConfigurationVariable,
    'selectionSource' | 'readOnly'
  >,
): boolean {
  return (
    node.readOnly ||
    node.selectionSource === 'locked' ||
    node.selectionSource === 'temporarilyLocked'
  );
}

/** An absent `maxSelections` is an unbounded group, not a single-choice one. */
export function isSingleSelect(
  group: Pick<ConfigurationOptionGroup, 'maxSelections'>,
): boolean {
  return group.maxSelections === 1;
}

function isRequiredGroup(
  group: Pick<ConfigurationOptionGroup, 'minSelections'>,
): boolean {
  return (group.minSelections ?? 0) > 0;
}

/**
 * Whether a group leads with the portal's own "nothing chosen" row: a single
 * choice the buyer may skip has no other way to say "none" once a real option
 * is chosen. The row is the portal's; the document never carries it.
 */
export function offersNoneRow(
  group: Pick<ConfigurationOptionGroup, 'minSelections' | 'maxSelections'>,
): boolean {
  return isSingleSelect(group) && !isRequiredGroup(group);
}

/**
 * The radio value of the "nothing chosen" row. It stays inside the form's
 * radio group and is never sent.
 */
export const NONE_ROW_VALUE = 'configurator:none';

/** The rows a group offers, the "nothing chosen" row included. */
export function groupRowCount(
  group: Pick<
    ConfigurationOptionGroup,
    'options' | 'minSelections' | 'maxSelections'
  >,
): number {
  return group.options.length + (offersNoneRow(group) ? 1 : 0);
}

/**
 * The one message a disabled or read-only row shows as its reason. An error
 * outranks a warning; beyond that the provider's order stands.
 */
export function blockingMessage(
  messages: ConfigurationMessage[],
): ConfigurationMessage | undefined {
  return (
    messages.find((message) => message.severity === 'error') ??
    messages.find((message) => message.severity === 'warning')
  );
}

/**
 * The severity a group's info icon takes: the most severe of its messages,
 * so a note beside an error does not soften it. `undefined` without any.
 */
export function groupInfoSeverity(
  messages: ConfigurationMessage[],
): ConfigurationMessage['severity'] | undefined {
  if (messages.some((message) => message.severity === 'error')) return 'error';
  if (messages.some((message) => message.severity === 'warning'))
    return 'warning';
  return messages.length ? 'info' : undefined;
}

/**
 * What a collapsed group says about itself in parentheses.
 *
 * A selected row the rules made unavailable still counts: it is part of the
 * configuration, and leaving it out would make a collapsed group look emptier
 * than it is.
 */
export type GroupSummary =
  | { kind: 'none' }
  | { kind: 'one'; name: string }
  | { kind: 'many'; count: number };

export function groupSummary(
  group: Pick<ConfigurationOptionGroup, 'options'>,
): GroupSummary {
  const selected = group.options.filter((option) => option.selected);
  const first = selected[0];
  if (!first) return { kind: 'none' };
  if (selected.length === 1) return { kind: 'one', name: first.name };
  return { kind: 'many', count: selected.length };
}

/**
 * Above this many rows a group is chosen from its full list, not inline: a
 * group with a choice to make is chosen from a list, and only a lone row is
 * shown as it is.
 */
export const OPTION_CHOOSER_ABOVE = 1;

export function usesChooser(rowCount: number): boolean {
  return rowCount > OPTION_CHOOSER_ABOVE;
}

/**
 * The first image of the option's product, as the product card: the list
 * fragment selects no `isPrimary`.
 */
export function optionImage(
  option: Pick<ConfigurationOption, 'product'>,
): string | undefined {
  return option.product?.productImages?.[0]?.fileName || undefined;
}

/**
 * Whether a group's rows carry an image column: all of them when one option
 * has an image, so every row is the same shape, and none when no option has.
 */
export function hasImageColumn(
  options: Pick<ConfigurationOption, 'product'>[],
): boolean {
  return options.some((option) => optionImage(option) !== undefined);
}

/**
 * Why a row cannot be used: the blocking message the provider put on it, or
 * else what the document says about it.
 */
export type OptionBlockReason =
  | { kind: 'message'; message: ConfigurationMessage }
  | { kind: 'read_only' }
  | { kind: 'unavailable' };

/**
 * Nothing while the form is locked: a batch in flight is not a fact about the
 * row.
 */
export function optionBlockReason(
  option: Pick<
    ConfigurationOption,
    'available' | 'messages' | 'readOnly' | 'selectionSource'
  >,
  formLocked: boolean,
): OptionBlockReason | undefined {
  if (formLocked) return undefined;
  const readOnly = isReadOnly(option);
  if (!readOnly && option.available) return undefined;
  const message = blockingMessage(option.messages);
  if (message) return { kind: 'message', message };
  return { kind: readOnly ? 'read_only' : 'unavailable' };
}

/** What a row adds to the configuration, signed, or `''` when it adds nothing. */
export function signedOptionPrice(
  net: number,
  currency: string | undefined,
  locale: string,
): string {
  const prefix = optionPricePrefix(net);
  if (prefix === null) return '';
  return `${prefix}${formatPrice(net, currency, locale)}`;
}

/**
 * Whether a row survives the full list's search. Both lines the row shows are
 * searched: a buyer who knows the article number types that, not the name.
 */
export function matchesOptionQuery(
  option: Pick<ConfigurationOption, 'name' | 'articleNumber'>,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  return (
    option.name.toLowerCase().includes(needle) ||
    option.articleNumber.toLowerCase().includes(needle)
  );
}

/**
 * The messages a node still has to show once one of them has been promoted to
 * a reason line of its own, so the same sentence is not printed twice.
 */
export function messagesBesides(
  messages: ConfigurationMessage[],
  used: ConfigurationMessage | undefined,
): ConfigurationMessage[] {
  if (!used) return messages;
  return messages.filter((message) => message !== used);
}

/**
 * Intersected with `Record` because `t(key, params)` takes an index signature
 * and a plain interface has none.
 */
export type BoundsParams = Record<string, string | number> & {
  min: number;
  max: number;
  unit: string;
};

/**
 * The caption under a number field. Returns params rather than a string so the
 * locale files own the text, and `undefined` when the provider narrowed
 * neither end — a caption that reads "0–0" is worse than none.
 */
export function boundsParams(
  variable: Pick<ConfigurationVariable, 'min' | 'max' | 'unit'>,
): BoundsParams | undefined {
  if (variable.min === undefined || variable.max === undefined)
    return undefined;
  return { min: variable.min, max: variable.max, unit: variable.unit ?? '' };
}

/**
 * Whether a rule has tightened a variable's range since the document the
 * baseline was taken from.
 *
 * The document carries only the range that holds now, never the one the
 * template started from, so the baseline can only be a range this session has
 * actually seen. Two consequences, both of them true of any baseline the
 * contract allows: a range the provider had already narrowed when the session
 * was created shows nothing, and a field that is unmounted and mounted again
 * starts over.
 */
export function boundsNarrowed(
  baseline: Pick<ConfigurationVariable, 'min' | 'max'>,
  current: Pick<ConfigurationVariable, 'min' | 'max'>,
): boolean {
  // An absent end is an open one, so a rule that gives it a number has
  // narrowed the range as much as one that lowers a cap.
  return (
    (current.max ?? Infinity) < (baseline.max ?? Infinity) ||
    (current.min ?? -Infinity) > (baseline.min ?? -Infinity)
  );
}

/**
 * A date input speaks `yyyy-mm-dd` while the document carries ISO 8601, which
 * may or may not have a time part. Anything else — a number, a boolean, an
 * unset value — leaves the field empty rather than showing a half-parsed date.
 */
export function dateInputValue(value: ConfigurationValue): string {
  if (typeof value !== 'string') return '';
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : '';
}

/** An emptied date field is an unset variable, which the contract writes null. */
export function dateChangeValue(raw: string): ConfigurationValue {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

/**
 * The requirement text a group's header carries on its right: what the buyer
 * must do with it, not a decoration on its name. A group the provider requires
 * says so; a single choice the buyer may skip says it is optional, and a group
 * that takes several says so. A required group the provider made unavailable
 * asks nothing of the buyer, so it carries no hint.
 */
export function groupHintKey(
  group: Pick<
    ConfigurationOptionGroup,
    'available' | 'minSelections' | 'maxSelections'
  >,
): string | undefined {
  if (isRequiredGroup(group)) {
    return group.available ? 'configurator.required' : undefined;
  }
  return isSingleSelect(group)
    ? 'configurator.optional'
    : 'configurator.choose_many';
}

/**
 * How an option row's price reads beside the row.
 *
 * A row priced at zero shows nothing: every untouched group would otherwise
 * carry a column of "0 kr" that says only that the provider has no surcharge
 * for it. `null` means render nothing; a string is the prefix the amount takes,
 * which is a sign only where the amount does not carry one itself.
 */
export function optionPricePrefix(net: number): string | null {
  if (net === 0) return null;
  return net > 0 ? '+' : '';
}

export type StepDirection = 'up' | 'down';

/**
 * What a stepper press sends from an empty number field: the field counts as
 * 0, and the step from there is clamped into the range. A step that would pass
 * a bound is not offered, as the stepper does for a filled field, so `null`
 * means the button is disabled.
 *
 * The stepper's own answer from empty is the floor, or 0 without one, for
 * either button — a value the buyer never chose, and one the provider may
 * refuse outright.
 */
export function emptyStep(
  variable: Pick<ConfigurationVariable, 'min' | 'max' | 'step'>,
  direction: StepDirection,
): number | null {
  const min = variable.min ?? -Infinity;
  const max = variable.max ?? Infinity;
  const step = variable.step ?? 1;
  if (direction === 'up') return step > max ? null : Math.max(step, min);
  return -step < min ? null : Math.min(-step, max);
}

/** Whether the change the provider refused was aimed at this variable. */
export function refusesVariable(
  refused: ConfigurationChange | null,
  variableId: string,
): boolean {
  return refused?.type === 'variable' && refused.variableId === variableId;
}

/**
 * Whether the change the provider refused was aimed at one of this group's own
 * options. A nested group answers for its own rows.
 */
export function refusesOptionIn(
  refused: ConfigurationChange | null,
  group: { options: Pick<ConfigurationOption, 'id' | 'instanceId'>[] },
): boolean {
  if (refused?.type !== 'option') return false;
  return group.options.some(
    (option) =>
      option.id === refused.optionId &&
      option.instanceId === refused.instanceId,
  );
}
