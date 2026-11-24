import type {
  Configuration,
  ConfigurationOptionGroup,
  ConfigurationSection,
} from '#shared/types/configurator';
import { shownOptions } from '~/utils/configurator-form';
import { shownMembers } from '~/utils/configurator-order';
import { visibleChildren } from '~/utils/configurator-sections';

// ---------------------------------------------------------------------------
// The document as the buyer is shown it, when the store hides what cannot be
// chosen (`productConfigurator.hideUnavailableOptions`).
//
// Built once on the page and handed to what draws the form, the rail, the
// banner and the specification, so none of them knows the setting exists and
// they cannot disagree about what is on screen. It is not the provider's
// document: anything that sends a change, commits, replays or compares reads
// the document as it arrived.
//
// A chosen option is never dropped, whatever the rules say of it now: the
// buyer has to be able to see and undo what is in their configuration.
// ---------------------------------------------------------------------------

/**
 * A group as shown, or `null` when it would show nothing. A row of an
 * unavailable group is unavailable whatever it says itself, and so is every
 * row below it, which is how the group renders it.
 */
function shownGroup(
  group: ConfigurationOptionGroup,
  parentUnavailable: boolean,
): ConfigurationOptionGroup | null {
  const unavailable = parentUnavailable || !group.available;
  const kept = {
    ...group,
    options: group.options.filter(
      (option) => option.selected || (option.available && !unavailable),
    ),
    optionGroups: group.optionGroups.flatMap((nested) => {
      const shown = shownGroup(nested, unavailable);
      return shown ? [shown] : [];
    }),
  };
  return shownOptions(kept).length || kept.optionGroups.length ? kept : null;
}

/**
 * A section the provider hid stays exactly as sent; one the setting empties is
 * marked hidden, so the rail, the pager and the banner leave it out the way
 * they leave out the provider's.
 */
function shownSection(section: ConfigurationSection): ConfigurationSection {
  if (!section.visible) return section;
  const kept = {
    ...section,
    optionGroups: section.optionGroups.flatMap((group) => {
      const shown = shownGroup(group, false);
      return shown ? [shown] : [];
    }),
    sections: section.sections.map(shownSection),
  };
  return {
    ...kept,
    visible: shownMembers(kept).length > 0 || visibleChildren(kept).length > 0,
  };
}

/** The document itself when the store shows everything. */
export function shownConfiguration(
  config: Configuration,
  hideUnavailable: boolean,
): Configuration {
  if (!hideUnavailable) return config;
  return { ...config, sections: config.sections.map(shownSection) };
}
