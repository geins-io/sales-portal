import type {
  Configuration,
  ConfigurationChange,
  ConfigurationOptionGroup,
  ConfigurationSection,
} from '#shared/types/configurator';
import type {
  ConfiguratorBackend,
  ConfiguratorContext,
  OrderLineChoices,
} from './configurator';

// ---------------------------------------------------------------------------
// A configured order row opened again: a new session, then one batch replaying
// what the row was committed with. An order row has no committed id to reopen
// from, so this is the only way back to its choices. The order itself never
// leaves the server; the page gets the session and whether it holds the
// order's choices.
// ---------------------------------------------------------------------------

export interface ReplayedConfiguration {
  configuration: Configuration;
  /** False when the session is on the defaults rather than the order's choices. */
  replayed: boolean;
}

/** The provider sets these, and refuses a change to one. */
function settable(node: { readOnly: boolean; selectionSource: string }) {
  return (
    !node.readOnly &&
    node.selectionSource !== 'locked' &&
    node.selectionSource !== 'temporarilyLocked'
  );
}

/** Every variable and option of the fresh session, by key: whether it is settable. */
function targetsOf(fresh: Configuration) {
  const variables = new Map<string, boolean>();
  const options = new Map<string, boolean>();
  const visitGroups = (groups: ConfigurationOptionGroup[]): void => {
    for (const group of groups) {
      for (const option of group.options) {
        options.set(optionKey(option), settable(option));
      }
      visitGroups(group.optionGroups);
    }
  };
  const visitSections = (sections: ConfigurationSection[]): void => {
    for (const section of sections) {
      for (const variable of section.variables) {
        variables.set(variable.id, settable(variable));
      }
      visitGroups(section.optionGroups);
      visitSections(section.sections);
    }
  };
  visitSections(fresh.sections);
  return { variables, options };
}

function optionKey(option: { id: string; instanceId: string }): string {
  return `${option.id}|${option.instanceId}`;
}

/**
 * The batch that puts the committed choices on a fresh session, leaving out
 * what the session does not let the buyer change: sent, the provider fails the
 * whole batch. Null when a committed choice is not in the session at all — the
 * template has moved since the order, and half the choices back is not the
 * order's configuration.
 */
export function replayChanges(
  choices: OrderLineChoices,
  fresh: Configuration,
): ConfigurationChange[] | null {
  const targets = targetsOf(fresh);
  const changes: ConfigurationChange[] = [];

  for (const variable of choices.variables) {
    const target = targets.variables.get(variable.id);
    if (target === undefined) return null;
    if (target) {
      changes.push({
        type: 'variable',
        variableId: variable.id,
        value: variable.value,
      });
    }
  }
  for (const option of choices.options) {
    const target = targets.options.get(optionKey(option));
    if (target === undefined) return null;
    if (target) {
      changes.push({
        type: 'option',
        optionId: option.id,
        instanceId: option.instanceId,
        selected: true,
        quantity: option.quantity,
        lock: 'none',
      });
    }
  }
  return changes;
}

/**
 * A new session of one for the product, holding the order row's choices when
 * they fit. Only a failed create fails the replay: anything after it leaves the
 * buyer on the defaults, told so.
 */
export async function replayOrderLine(
  backend: ConfiguratorBackend,
  input: { productId: string; publicOrderId: string; row: number },
  ctx: ConfiguratorContext,
): Promise<ReplayedConfiguration> {
  const [created, choices] = await Promise.all([
    backend.create({ productId: input.productId, quantity: 1 }, ctx),
    backend
      .orderLineChoices(input.publicOrderId, input.row, ctx)
      .catch(() => null),
  ]);

  const defaults = { configuration: created, replayed: false };
  if (!choices || String(choices.productId) !== input.productId) {
    return defaults;
  }
  const changes = replayChanges(choices, created);
  if (!changes) return defaults;
  if (changes.length === 0) return { configuration: created, replayed: true };

  try {
    return {
      configuration: await backend.applyChanges(
        created.configurationId,
        changes,
        ctx,
      ),
      replayed: true,
    };
  } catch {
    // A refused batch fails whole; a timed-out one may not have. What the
    // session holds now is the provider's to say.
    try {
      return {
        configuration: await backend.get(created.configurationId, ctx),
        replayed: false,
      };
    } catch (cause) {
      // The page never learns this session's id, so nothing else would release it.
      await backend.release(created.configurationId, ctx).catch(() => {});
      throw cause;
    }
  }
}
