import type {
  Configuration,
  ConfigurationChange,
  ConfigurationOption,
  ConfigurationOptionGroup,
  ConfigurationSection,
} from '#shared/types/configurator';
import { logger } from '../utils/logger';
import type { ConfiguratorBackend } from './configurator';

// ---------------------------------------------------------------------------
// Locks the provider has ruled out.
//
// The real provider keeps a pick locked after a later choice has made it
// unavailable: deselected, unavailable, `locked`, with an error that the rail
// counts and that keeps the document invalid. No row the buyer can reach
// clears it. A plain deselect does, and changes no selection and no price, so
// the portal sends it and tells the buyer what went.
//
// A pick sent before its unlock answers the very same fields, so a row the
// batch itself picked is left: it is waiting, not stale. A hidden section is
// left too, as the provider's own business.
// ---------------------------------------------------------------------------

function isStale(option: ConfigurationOption): boolean {
  return (
    !option.selected &&
    !option.available &&
    !option.readOnly &&
    option.selectionSource === 'locked' &&
    option.messages.some((message) => message.severity === 'error')
  );
}

const sameRow = (
  option: Pick<ConfigurationOption, 'id' | 'instanceId'>,
  change: ConfigurationChange,
) =>
  change.type === 'option' &&
  change.selected &&
  change.optionId === option.id &&
  change.instanceId === option.instanceId;

/**
 * The options in visible sections the provider ruled out and kept locked, in
 * document order, leaving out any the batch that produced the document picked.
 */
export function staleLocks(
  config: Configuration,
  changes: ConfigurationChange[],
): ConfigurationOption[] {
  const found: ConfigurationOption[] = [];

  const walkGroup = (group: ConfigurationOptionGroup): void => {
    for (const option of group.options) {
      if (isStale(option) && !changes.some((c) => sameRow(option, c))) {
        found.push(option);
      }
    }
    group.optionGroups.forEach(walkGroup);
  };
  const walkSection = (section: ConfigurationSection): void => {
    if (!section.visible) return;
    section.optionGroups.forEach(walkGroup);
    section.sections.forEach(walkSection);
  };
  config.sections.forEach(walkSection);

  return found;
}

/**
 * Deselects what `staleLocks` finds in one batch and answers that document,
 * naming what went. Once: a deselect locks nothing. A failed deselect answers
 * the first document, which is where the buyer stood before this existed.
 */
async function releaseStaleLocks(
  backend: ConfiguratorBackend,
  answer: Configuration,
  changes: ConfigurationChange[],
  ctx: Parameters<ConfiguratorBackend['applyChanges']>[2],
): Promise<Configuration> {
  const stale = staleLocks(answer, changes);
  if (stale.length === 0) return answer;

  try {
    const cleared = await backend.applyChanges(
      answer.configurationId,
      stale.map(
        (option): ConfigurationChange => ({
          type: 'option',
          optionId: option.id,
          instanceId: option.instanceId,
          selected: false,
          lock: 'none',
        }),
      ),
      ctx,
    );
    return {
      ...cleared,
      released: stale.map((option) => ({
        optionId: option.id,
        instanceId: option.instanceId,
        name: option.name || option.articleNumber,
      })),
    };
  } catch (cause) {
    logger.warn(
      `[configurator] could not release ${stale.length} ruled-out lock(s) on ${answer.configurationId}: ${String(cause)}`,
    );
    return answer;
  }
}

/** The backend with its change and reopen answers released of stale locks. */
export function withStaleLocksReleased(
  backend: ConfiguratorBackend,
): ConfiguratorBackend {
  return {
    ...backend,
    applyChanges: async (id, changes, ctx) =>
      releaseStaleLocks(
        backend,
        await backend.applyChanges(id, changes, ctx),
        changes,
        ctx,
      ),
    reopen: async (cartId, itemId, ctx) =>
      releaseStaleLocks(
        backend,
        await backend.reopen(cartId, itemId, ctx),
        [],
        ctx,
      ),
  };
}
