import type { PriceType } from '#shared/types/commerce';
import type {
  Configuration,
  ConfigurationMessage,
  ConfigurationOption,
  ConfigurationOptionGroup,
  ConfigurationSection,
  ConfigurationValue,
  ConfigurationValueType,
  ConfigurationVariable,
  SelectionSource,
  ValueSource,
} from '#shared/types/configurator';
import { logger } from '../../utils/logger';
import type {
  WireConfiguration,
  WireDecimal,
  WireMessage,
  WireOption,
  WireOptionGroup,
  WireSection,
  WireValue,
  WireVariable,
} from './wire';

// ---------------------------------------------------------------------------
// From the wire to the portal's document. Pure apart from the warnings.
//
// A node without an id cannot be addressed by a change batch, so it is dropped
// with its subtree rather than rendered as something the buyer cannot answer.
// ---------------------------------------------------------------------------

const SELECTION_SOURCES: readonly SelectionSource[] = [
  'none',
  'initial',
  'manual',
  'ruleSelected',
  'ruleDeselected',
  'groupRule',
  'locked',
  'temporarilyLocked',
  'unknown',
];

const VALUE_SOURCES: readonly ValueSource[] = [
  'initial',
  'manual',
  'formula',
  'linked',
  'fallback',
  'unknown',
];

const VALUE_TYPES: readonly ConfigurationValueType[] = [
  'string',
  'number',
  'boolean',
  'date',
];

/** `RULE_SELECTED` → `ruleSelected`. */
function camel(value: string): string {
  return value
    .toLowerCase()
    .replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

/** The known member, or `unknown` with the provider's own value beside it. */
function source<T extends string>(
  known: readonly T[],
  wire: string,
): { value: T | 'unknown'; raw?: string } {
  const value = known.find((member) => member === camel(wire));
  return value ? { value } : { value: 'unknown', raw: wire };
}

function decimal(value: WireDecimal | null): number | undefined {
  if (value === null) return undefined;
  const number = Number(value);
  return Number.isNaN(number) ? undefined : number;
}

/** Spread only when present, so an absent bound stays absent. */
function optional<K extends string, V>(
  key: K,
  value: V | null | undefined,
): Partial<Record<K, V>> {
  // A computed key widens to an index signature; the record is exactly `K`.
  return value === null || value === undefined
    ? {}
    : ({ [key]: value } as Record<K, V>);
}

function nodes<W, T>(
  list: (W | null)[] | null,
  map: (node: W) => T | undefined,
): T[] {
  return (list ?? []).flatMap((node) => {
    if (node === null) return [];
    const mapped = map(node);
    return mapped === undefined ? [] : [mapped];
  });
}

function addressable<W extends { id: string | null; name: string | null }>(
  kind: string,
  node: W,
): node is W & { id: string } {
  if (node.id !== null) return true;
  logger.warn(
    `[configurator] dropped a ${kind} without an id: ${node.name ?? '(no name)'}`,
  );
  return false;
}

function messages(list: (WireMessage | null)[] | null): ConfigurationMessage[] {
  return nodes(list, (message) => {
    const severity = camel(message.severity);
    return severity === 'error' || severity === 'warning'
      ? { severity, text: message.text ?? '' }
      : undefined;
  });
}

function price(value: PriceType | null): PriceType {
  return value ?? {};
}

function valueOf(
  type: ConfigurationValueType,
  value: WireValue,
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

function variable(wire: WireVariable): ConfigurationVariable | undefined {
  if (!addressable('variable', wire)) return undefined;

  const valueType = VALUE_TYPES.find((type) => type === camel(wire.valueType));
  if (!valueType) {
    logger.warn(
      `[configurator] variable ${wire.name ?? wire.id} has value type ${wire.valueType}; rendered as a string`,
    );
  }
  const type = valueType ?? 'string';
  const selection = source(SELECTION_SOURCES, wire.selectionSource);
  const valueSource = source(VALUE_SOURCES, wire.valueSource);

  return {
    id: wire.id,
    name: wire.name ?? '',
    sortIndex: wire.sortIndex,
    description: wire.description ?? '',
    valueType: type,
    value: valueOf(type, wire.value),
    defaultValue: valueOf(type, wire.defaultValue),
    required: wire.required,
    available: wire.available,
    readOnly: wire.readOnly,
    ...optional('min', decimal(wire.min)),
    ...optional('max', decimal(wire.max)),
    ...optional('step', decimal(wire.step)),
    ...optional('decimals', wire.decimals),
    ...optional('unit', wire.unit),
    selectionSource: selection.value,
    ...optional('selectionSourceRaw', selection.raw),
    valueSource: valueSource.value,
    ...optional('valueSourceRaw', valueSource.raw),
    messages: messages(wire.messages),
  };
}

function option(wire: WireOption): ConfigurationOption | undefined {
  if (!addressable('option', wire)) return undefined;
  const selection = source(SELECTION_SOURCES, wire.selectionSource);

  return {
    id: wire.id,
    instanceId: wire.instanceId ?? '',
    articleNumber: wire.articleNumber ?? '',
    name: wire.name ?? '',
    description: wire.description ?? '',
    selected: wire.selected,
    available: wire.available,
    readOnly: wire.readOnly,
    selectionSource: selection.value,
    ...optional('selectionSourceRaw', selection.raw),
    quantity: Number(wire.quantity),
    defaultQuantity: Number(wire.defaultQuantity),
    ...optional('minQuantity', decimal(wire.minQuantity)),
    ...optional('maxQuantity', decimal(wire.maxQuantity)),
    unitPrice: price(wire.unitPrice),
    discountPercent: decimal(wire.discountPercent) ?? 0,
    messages: messages(wire.messages),
    product: wire.product,
  };
}

function optionGroup(
  wire: WireOptionGroup,
): ConfigurationOptionGroup | undefined {
  if (!addressable('option group', wire)) return undefined;

  return {
    id: wire.id,
    code: wire.code ?? '',
    name: wire.name ?? '',
    description: wire.description ?? '',
    sortIndex: wire.sortIndex,
    available: wire.available,
    ...optional('minSelections', wire.minSelections),
    ...optional('maxSelections', wire.maxSelections),
    ...optional('minQuantity', decimal(wire.minQuantity)),
    ...optional('maxQuantity', decimal(wire.maxQuantity)),
    quantityEditable: wire.quantityEditable,
    optionGroups: nodes(wire.optionGroups, optionGroup),
    options: nodes(wire.options, option),
    messages: messages(wire.messages),
  };
}

function section(wire: WireSection): ConfigurationSection | undefined {
  if (!addressable('section', wire)) return undefined;

  return {
    id: wire.id,
    name: wire.name ?? '',
    description: wire.description ?? '',
    sortIndex: wire.sortIndex,
    visible: wire.visible,
    sections: nodes(wire.sections, section),
    variables: nodes(wire.variables, variable),
    optionGroups: nodes(wire.optionGroups, optionGroup),
    messages: messages(wire.messages),
  };
}

export function mapConfiguration(wire: WireConfiguration): Configuration {
  return {
    configurationId: wire.configurationId,
    expiresAt: wire.expiresAt,
    isValid: wire.isValid,
    articleNumber: wire.articleNumber ?? '',
    quantity: Number(wire.quantity),
    unitPrice: price(wire.unitPrice),
    discountPercent: decimal(wire.discountPercent) ?? 0,
    ...optional('weightPerUnit', decimal(wire.weightPerUnit)),
    templateId: wire.templateId ?? '',
    templateVersion: wire.templateVersion ?? '',
    messages: messages(wire.messages),
    sections: nodes(wire.sections, section),
  };
}
