import type {
  LineConfigurationGroup,
  LineConfigurationSection,
  LineConfigurationVariable,
} from '#shared/types/commerce';
import type {
  Configuration,
  ConfigurationOptionGroup,
  ConfigurationSection,
  ConfigurationVariable,
} from '#shared/types/configurator';

// ---------------------------------------------------------------------------
// The structure a committed configuration carries on a cart line: only what
// the buyer saw and chose, with names, indexes and option prices.
//
// What it leaves out follows `buildSummary`, so a fixture line's sections and
// summary agree: a hidden section with its subtree, an option not chosen, and
// a variable that is unavailable or holds nothing. A group with nothing chosen
// stays only for a group under it that holds a choice. The order is the
// document's; sorting is the panel's rule.
// ---------------------------------------------------------------------------

function committedGroup(
  group: ConfigurationOptionGroup,
): LineConfigurationGroup | undefined {
  const options = group.options
    .filter((option) => option.selected)
    .map((option) => ({
      name: option.name,
      quantity: option.quantity,
      unitPrice: option.unitPrice,
    }));
  const optionGroups = committedGroups(group.optionGroups);
  if (!options.length && !optionGroups.length) return undefined;
  return {
    id: group.id,
    name: group.name,
    sortIndex: group.sortIndex ?? null,
    options,
    optionGroups,
  };
}

function committedGroups(
  groups: ConfigurationOptionGroup[],
): LineConfigurationGroup[] {
  return groups.flatMap((group) => committedGroup(group) ?? []);
}

function committedVariables(
  variables: ConfigurationVariable[],
): LineConfigurationVariable[] {
  return variables
    .filter(
      ({ available, value }) => available && value !== null && value !== '',
    )
    .map((variable) => ({
      id: variable.id,
      name: variable.name,
      sortIndex: variable.sortIndex ?? null,
      value: variable.value,
      ...(variable.unit ? { unit: variable.unit } : {}),
      ...(variable.decimals === undefined
        ? {}
        : { decimals: variable.decimals }),
    }));
}

function committedSections(
  sections: ConfigurationSection[],
): LineConfigurationSection[] {
  return sections
    .filter((section) => section.visible)
    .map((section) => ({
      name: section.name,
      sortIndex: section.sortIndex ?? null,
      variables: committedVariables(section.variables),
      optionGroups: committedGroups(section.optionGroups),
      sections: committedSections(section.sections),
    }));
}

export function buildCommittedSections(
  config: Configuration,
): LineConfigurationSection[] {
  return committedSections(config.sections);
}
