import type {
  ConfigurationMessage,
  ConfigurationOption,
  ConfigurationOptionGroup,
  ConfigurationValue,
  ConfigurationVariable,
  SelectionSource,
} from '#shared/types/configurator';

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
export function isReadOnly(source: SelectionSource): boolean {
  return source === 'locked' || source === 'temporarilyLocked';
}

/** An absent `maxSelections` is an unbounded group, not a single-choice one. */
export function isSingleSelect(
  group: Pick<ConfigurationOptionGroup, 'maxSelections'>,
): boolean {
  return group.maxSelections === 1;
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
  if (selected.length === 1) return { kind: 'one', name: first.product.name };
  return { kind: 'many', count: selected.length };
}

/** Above this many rows a group folds to a preview and offers the full list. */
export const OPTION_PREVIEW_LIMIT = 5;

/**
 * The rows a long group shows inline. The selected ones lead, so a choice made
 * in the full list is still on screen once the list closes.
 */
export function previewOptions<T extends Pick<ConfigurationOption, 'selected'>>(
  options: T[],
): T[] {
  if (options.length <= OPTION_PREVIEW_LIMIT) return options;
  return [
    ...options.filter((option) => option.selected),
    ...options.filter((option) => !option.selected),
  ].slice(0, OPTION_PREVIEW_LIMIT);
}

/**
 * Whether a row survives the full list's search. Both lines the row shows are
 * searched: a buyer who knows the article number types that, not the name.
 */
export function matchesOptionQuery(
  option: Pick<ConfigurationOption, 'product'>,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  return (
    option.product.name.toLowerCase().includes(needle) ||
    option.product.articleNumber.toLowerCase().includes(needle)
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
 * What the measurements block says it holds while it is folded: the values, in
 * the document's order, each with its unit.
 *
 * Only a number or a text value is readable without a translation — a boolean
 * reads as a word the locale files own and a pure function cannot produce — so
 * the rest are left out rather than rendered as `true`.
 */
export function variablesSummary(
  variables: Pick<ConfigurationVariable, 'value' | 'unit'>[],
): string {
  return variables
    .filter(
      (variable) =>
        typeof variable.value === 'number' ||
        (typeof variable.value === 'string' && variable.value !== ''),
    )
    .map((variable) =>
      variable.unit
        ? `${variable.value} ${variable.unit}`
        : `${variable.value}`,
    )
    .join(' · ');
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
 * that takes several says so.
 */
export function groupHintKey(
  group: Pick<ConfigurationOptionGroup, 'minSelections' | 'maxSelections'>,
): string {
  if ((group.minSelections ?? 0) > 0) return 'configurator.required';
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
