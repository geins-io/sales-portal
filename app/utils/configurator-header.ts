import type { Configuration } from '#shared/types/configurator';

// ---------------------------------------------------------------------------
// The two derivations the configuration header renders.
//
// They live here rather than in the component because Stryker produces no
// mutants from a `.vue` file: a derivation written in a template is one nothing
// can prove.
// ---------------------------------------------------------------------------

/**
 * Every blocking message in the document, in document order, without repeats.
 *
 * The walk covers the whole tree because that is where the provider puts them:
 * in every example document the root's and the sections' own `messages` are
 * empty and the errors sit on the option groups, so a reader of
 * `configuration.messages` alone shows an invalid configuration with no reason
 * at all.
 *
 * Repeats are dropped. Two groups can carry the same sentence, and the same
 * line twice in a list reads as a defect rather than as two problems.
 */
export function collectBlockingMessages(config: Configuration): string[] {
  const texts: string[] = [];

  const take = (messages: Configuration['messages']): void => {
    for (const message of messages) {
      if (message.severity === 'error') texts.push(message.text);
    }
  };

  const walkGroups = (
    groups: Configuration['sections'][number]['optionGroups'],
  ): void => {
    for (const group of groups) {
      take(group.messages);
      walkGroups(group.optionGroups);
      for (const option of group.options) take(option.messages);
    }
  };

  const walkSections = (sections: Configuration['sections']): void => {
    for (const section of sections) {
      take(section.messages);
      for (const variable of section.variables) take(variable.messages);
      walkGroups(section.optionGroups);
      walkSections(section.sections);
    }
  };

  take(config.messages);
  walkSections(config.sections);

  return [...new Set(texts)];
}

/**
 * Remaining session time as a zero-padded `mm:ss` clock, floored at `0:00`.
 *
 * Past an hour it keeps counting in minutes (`65:04`). A session lasts minutes,
 * so an hours field would be a branch no document can reach.
 */
export function formatRemaining(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}
