import type {
  Configuration,
  ConfigurationMessage,
  ConfigurationOptionGroup,
  ConfigurationSection,
  ConfigurationVariable,
} from '#shared/types/configurator';
import {
  isGroupShortOfMinimum,
  isRequiredVariableEmpty,
} from '#shared/utils/configurator-requirement';
import type { ConfiguratorBackend } from './configurator';

// ---------------------------------------------------------------------------
// Provider messages that say only what the node already says.
//
// The real provider puts an error on every required variable and group it is
// still waiting for, and drops them after the first change batch. The page
// derives "unmet" from the node itself and names it in the banner, so the same
// fact would show twice. Recognised by the node, never by the text: the text is
// the provider's, localised, and can change.
//
// Availability is not consulted. An unavailable node is never unmet, so its
// error would be the only thing the rail counted, for a field the buyer cannot
// fill.
// ---------------------------------------------------------------------------

const withoutErrors = (messages: ConfigurationMessage[]) =>
  messages.filter((message) => message.severity !== 'error');

function filterVariable(
  variable: ConfigurationVariable,
): ConfigurationVariable {
  if (!isRequiredVariableEmpty(variable)) return variable;
  return { ...variable, messages: withoutErrors(variable.messages) };
}

function filterGroup(
  group: ConfigurationOptionGroup,
): ConfigurationOptionGroup {
  return {
    ...group,
    messages: isGroupShortOfMinimum(group)
      ? withoutErrors(group.messages)
      : group.messages,
    optionGroups: group.optionGroups.map(filterGroup),
  };
}

// Visibility is not consulted: a hidden section's requirements are just as
// unmet, and most of the measured messages sit in hidden sections.
function filterSection(section: ConfigurationSection): ConfigurationSection {
  return {
    ...section,
    sections: section.sections.map(filterSection),
    variables: section.variables.map(filterVariable),
    optionGroups: section.optionGroups.map(filterGroup),
  };
}

/**
 * Drops an error on a required variable left empty or an option group short of
 * its minimum. Every other message, and `isValid`, is left as the provider sent it.
 */
export function dropRestatedRequirements(config: Configuration): Configuration {
  return { ...config, sections: config.sections.map(filterSection) };
}

/**
 * The backend with its document answers filtered. Every other member is the
 * inner backend's own; a spread copy loses `this`, which no backend uses.
 */
export function withoutRestatedRequirements(
  backend: ConfiguratorBackend,
): ConfiguratorBackend {
  return {
    ...backend,
    create: async (input, ctx) =>
      dropRestatedRequirements(await backend.create(input, ctx)),
    get: async (id, ctx) =>
      dropRestatedRequirements(await backend.get(id, ctx)),
    applyChanges: async (id, changes, ctx) =>
      dropRestatedRequirements(await backend.applyChanges(id, changes, ctx)),
  };
}
