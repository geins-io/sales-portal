import type {
  Configuration,
  ConfigurationOption,
  ConfigurationOptionGroup,
  ConfigurationSection,
  ConfigurationVariable,
} from '#shared/types/configurator';

// ---------------------------------------------------------------------------
// Walking a configuration document.
//
// Sections nest inside sections and groups inside groups, so every pass over a
// document is a recursive flatten. The engine does several of them per change
// batch; they live here so the rules, the pricing and the summary all address a
// node the same way.
// ---------------------------------------------------------------------------

export function everySection(
  sections: ConfigurationSection[],
): ConfigurationSection[] {
  return sections.flatMap((section) => [
    section,
    ...everySection(section.sections),
  ]);
}

export function everyGroup(
  sections: ConfigurationSection[],
): ConfigurationOptionGroup[] {
  const fromGroups = (
    groups: ConfigurationOptionGroup[],
  ): ConfigurationOptionGroup[] =>
    groups.flatMap((group) => [group, ...fromGroups(group.optionGroups)]);
  return everySection(sections).flatMap((section) =>
    fromGroups(section.optionGroups),
  );
}

export function everyOption(
  sections: ConfigurationSection[],
): ConfigurationOption[] {
  return everyGroup(sections).flatMap((group) => group.options);
}

export function everyVariable(
  sections: ConfigurationSection[],
): ConfigurationVariable[] {
  return everySection(sections).flatMap((section) => section.variables);
}

/** The key a session's state stores an option row under. */
export function optionKey(optionId: string, instanceId: string): string {
  return `${optionId}|${instanceId}`;
}

export function findOption(
  config: Configuration,
  id: string,
  instanceId?: string,
): ConfigurationOption | undefined {
  return everyOption(config.sections).find(
    (option) =>
      option.id === id &&
      (instanceId === undefined || option.instanceId === instanceId),
  );
}

export function findVariable(
  config: Configuration,
  id: string,
): ConfigurationVariable | undefined {
  return everyVariable(config.sections).find((variable) => variable.id === id);
}

/** The group an option row sits in, for the single-select rule. */
export function findGroupOf(
  config: Configuration,
  optionId: string,
): ConfigurationOptionGroup | undefined {
  return everyGroup(config.sections).find((group) =>
    group.options.some((option) => option.id === optionId),
  );
}
