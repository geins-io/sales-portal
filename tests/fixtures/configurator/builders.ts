import type {
  Configuration,
  ConfigurationOption,
  ConfigurationOptionGroup,
  ConfigurationSection,
  ConfigurationVariable,
} from '#shared/types/configurator';

// ---------------------------------------------------------------------------
// Shared plumbing for the example configuration documents.
//
// The finders live here rather than in a spec because the documents are built
// by deriving one from another: `cascaded` and `invalid` are `initial` with
// named nodes changed, and the specs address the same nodes the same way.
// ---------------------------------------------------------------------------

export const CURRENCY = 'SEK';

function everySection(config: Configuration): ConfigurationSection[] {
  const collect = (sections: ConfigurationSection[]): ConfigurationSection[] =>
    sections.flatMap((section) => [section, ...collect(section.sections)]);
  return collect(config.sections);
}

function everyGroup(config: Configuration): ConfigurationOptionGroup[] {
  const collect = (
    groups: ConfigurationOptionGroup[],
  ): ConfigurationOptionGroup[] =>
    groups.flatMap((group) => [group, ...collect(group.optionGroups)]);
  return everySection(config).flatMap((section) =>
    collect(section.optionGroups),
  );
}

/** Throws rather than returning undefined: a missing node is a broken fixture. */
export function findOptionGroup(
  config: Configuration,
  id: string,
): ConfigurationOptionGroup {
  const group = everyGroup(config).find((candidate) => candidate.id === id);
  if (!group) throw new Error(`No option group '${id}' in the configuration`);
  return group;
}

export function findOption(
  config: Configuration,
  id: string,
): ConfigurationOption {
  const option = everyGroup(config)
    .flatMap((group) => group.options)
    .find((candidate) => candidate.id === id);
  if (!option) throw new Error(`No option '${id}' in the configuration`);
  return option;
}

export function findVariable(
  config: Configuration,
  id: string,
): ConfigurationVariable {
  const variable = everySection(config)
    .flatMap((section) => section.variables)
    .find((candidate) => candidate.id === id);
  if (!variable) throw new Error(`No variable '${id}' in the configuration`);
  return variable;
}
