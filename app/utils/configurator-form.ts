import type {
  ConfigurationMessage,
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
 * says so; anything else says how many rows may be picked.
 */
export function groupHintKey(
  group: Pick<ConfigurationOptionGroup, 'minSelections' | 'maxSelections'>,
): string {
  if ((group.minSelections ?? 0) > 0) return 'configurator.required';
  return isSingleSelect(group)
    ? 'configurator.choose_one'
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
