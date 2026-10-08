import type {
  ConfigurationValue,
  ConfigurationValueType,
} from '#shared/types/configurator';
import type {
  CommittedConfigurationVariableType,
  ConfigurationValue as SdkConfigurationValue,
} from '@geins/types';

// ---------------------------------------------------------------------------
// A variable's value off the wire, read by its value type. Shared by the live
// document and by a committed configuration, which a cart line, an order row
// and the order's replay all read.
// ---------------------------------------------------------------------------

export const VALUE_TYPES: readonly ConfigurationValueType[] = [
  'string',
  'number',
  'boolean',
  'date',
];

/** `RULE_SELECTED` → `ruleSelected`. */
export function camel(value: string): string {
  return value
    .toLowerCase()
    .replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

export function valueOf(
  type: ConfigurationValueType,
  value: SdkConfigurationValue,
): ConfigurationValue {
  if (value === null) return null;
  switch (type) {
    case 'number': {
      const number = Number(value);
      return typeof value === 'boolean' || Number.isNaN(number) ? null : number;
    }
    case 'boolean':
      if (typeof value === 'boolean') return value;
      return value === 'true' ? true : value === 'false' ? false : null;
    default:
      return String(value);
  }
}

/** A committed value is a string in invariant culture, typed by `valueType`. */
export function committedValue(
  variable: Pick<CommittedConfigurationVariableType, 'valueType' | 'value'>,
): ConfigurationValue {
  const type = VALUE_TYPES.find((known) => known === camel(variable.valueType));
  return type ? valueOf(type, variable.value) : variable.value;
}
