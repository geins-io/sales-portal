import type {
  CartLineConfiguration,
  CartLineConfigurationRow,
  LineConfigurationGroup,
  LineConfigurationOption,
  LineConfigurationSection,
  LineConfigurationSummary,
  LineConfigurationVariable,
} from '#shared/types/commerce';
import type {
  CartItemConfigurationType,
  CommittedConfigurationOptionGroupType,
  CommittedConfigurationOptionType,
  CommittedConfigurationSectionType,
  CommittedConfigurationVariableType,
  ConfigurationSummaryLineType,
} from '@geins/types';
import { committedValue } from './configuration-value';

/** A committed summary as the buyer reads it; a null label or value is empty. */
export function summaryRows(
  list: ConfigurationSummaryLineType[],
): CartLineConfigurationRow[] {
  return list.map((line) => ({
    label: line.label ?? '',
    value: line.value ?? '',
  }));
}

// The deepest level of each walk is selected without its children, so a list
// the read did not select arrives absent.

function option(
  wire: CommittedConfigurationOptionType,
): LineConfigurationOption {
  return {
    name: wire.name ?? '',
    ...(wire.quantity === null ? {} : { quantity: Number(wire.quantity) }),
    ...(wire.unitPrice ? { unitPrice: wire.unitPrice } : {}),
  };
}

function group(
  wire: CommittedConfigurationOptionGroupType,
): LineConfigurationGroup {
  return {
    id: wire.id ?? '',
    name: wire.name ?? '',
    sortIndex: wire.sortIndex,
    options: wire.options.map(option),
    optionGroups: (wire.optionGroups ?? []).map(group),
  };
}

function variable(
  wire: CommittedConfigurationVariableType,
): LineConfigurationVariable {
  return {
    id: wire.id ?? '',
    name: wire.name ?? '',
    sortIndex: wire.sortIndex,
    value: committedValue(wire),
    ...(wire.unit ? { unit: wire.unit } : {}),
    ...(wire.decimals === null ? {} : { decimals: wire.decimals }),
  };
}

function section(
  wire: CommittedConfigurationSectionType,
): LineConfigurationSection {
  return {
    name: wire.name ?? '',
    sortIndex: wire.sortIndex,
    variables: wire.variables.map(variable),
    optionGroups: wire.optionGroups.map(group),
    sections: (wire.sections ?? []).map(section),
  };
}

/**
 * What a configured line or order row was committed with. Its sections in the
 * order they were sent: sorting is the panel's rule.
 */
export function lineConfiguration(
  wire: Pick<CartItemConfigurationType, 'summary' | 'sections'>,
): LineConfigurationSummary {
  return {
    summary: summaryRows(wire.summary),
    ...(wire.sections ? { sections: wire.sections.map(section) } : {}),
  };
}

/**
 * A cart line's configuration, from the line as the SDK reads it. A line with
 * an id and no configuration was added before the configuration was copied
 * onto cart items: it is still configured, with no summary to show.
 */
export function cartLineConfiguration(line: {
  configurationId?: string | null;
  configuration?: Pick<
    CartItemConfigurationType,
    'summary' | 'sections'
  > | null;
}): CartLineConfiguration | undefined {
  if (!line.configurationId) return undefined;
  return {
    configurationId: line.configurationId,
    ...lineConfiguration(line.configuration ?? { summary: [] }),
  };
}
