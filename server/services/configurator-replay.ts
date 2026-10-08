import type {
  Configuration,
  ConfigurationChange,
  ConfigurationChoices,
  ConfigurationOptionGroup,
  ConfigurationSection,
  ConfigurationVariable,
  CreateConfigurationInput,
  RestoreConfigurationInput,
} from '#shared/types/configurator';
import {
  isOptionReadOnly,
  isSingleSelect,
  singleChoiceChanges,
} from '#shared/utils/configurator-choice';
import type { ConfiguratorBackend, ConfiguratorContext } from './configurator';

// ---------------------------------------------------------------------------
// Choices replayed into a new session: one create, then one batch. Two ways
// back use it. A configured order row has no committed id to reopen from, so
// this is the only way back to its choices; the order itself never leaves the
// server. A session that expired on the product page is gone upstream, and
// the page sends the choices it last held. Either way the page gets the
// session and whether it holds the choices.
// ---------------------------------------------------------------------------

export interface ReplayedConfiguration {
  configuration: Configuration;
  /** False when the session is on the defaults, because a choice did not land. */
  replayed: boolean;
}

/** The provider sets these, and refuses a change to one. */
function settableVariable(variable: {
  readOnly: boolean;
  selectionSource: string;
}) {
  return (
    !variable.readOnly &&
    variable.selectionSource !== 'locked' &&
    variable.selectionSource !== 'temporarilyLocked'
  );
}

/**
 * Every variable of the fresh session by id, whether it is settable; every
 * option by key, its group when it is settable, false when it is not.
 */
function targetsOf(fresh: Configuration) {
  const variables = new Map<string, boolean>();
  const options = new Map<string, ConfigurationOptionGroup | false>();
  const visitGroups = (groups: ConfigurationOptionGroup[]): void => {
    for (const group of groups) {
      for (const option of group.options) {
        options.set(optionKey(option), !isOptionReadOnly(option) && group);
      }
      visitGroups(group.optionGroups);
    }
  };
  const visitSections = (sections: ConfigurationSection[]): void => {
    for (const section of sections) {
      for (const variable of section.variables) {
        variables.set(variable.id, settableVariable(variable));
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
  choices: ConfigurationChoices,
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
      const pick: Extract<ConfigurationChange, { type: 'option' }> = {
        type: 'option',
        optionId: option.id,
        instanceId: option.instanceId,
        selected: true,
        // Only a buyer's own change carries a quantity, and only an editable
        // group takes one; left out, the provider keeps the row's own.
        ...(target.quantityEditable &&
          option.quantity > 0 && { quantity: option.quantity }),
        lock: 'none',
      };
      // Beside a locked current row a plain select leaves two selected.
      changes.push(
        ...(isSingleSelect(target)
          ? singleChoiceChanges(target, pick)
          : [pick]),
      );
    }
  }
  return changes;
}

/**
 * Whether every choice is in the document: each variable at its value, each
 * option selected. What the provider sets itself counts too: a choice it
 * computes to another value now is not the choice that was made.
 */
export function landed(
  choices: ConfigurationChoices,
  document: Configuration,
): boolean {
  const { variables, options } = valuesOf(document);
  return (
    choices.variables.every(
      ({ id, value }) => variables.has(id) && variables.get(id) === value,
    ) && choices.options.every((option) => options.get(optionKey(option)))
  );
}

/** Every variable's value by id; every option's `selected` by key. */
function valuesOf(document: Configuration) {
  const variables = new Map<string, ConfigurationVariable['value']>();
  const options = new Map<string, boolean>();
  const visitGroups = (groups: ConfigurationOptionGroup[]): void => {
    for (const group of groups) {
      for (const option of group.options) {
        options.set(optionKey(option), option.selected);
      }
      visitGroups(group.optionGroups);
    }
  };
  const visitSections = (sections: ConfigurationSection[]): void => {
    for (const section of sections) {
      for (const variable of section.variables) {
        variables.set(variable.id, variable.value);
      }
      visitGroups(section.optionGroups);
      visitSections(section.sections);
    }
  };
  visitSections(document.sections);
  return { variables, options };
}

/**
 * A new session for the product, holding the choices when every one of them
 * lands, and on the defaults otherwise: part of the choices back is not the
 * configuration the buyer made. The choices are read while the session is
 * created. Only a failed create fails the replay.
 */
async function replayChoices(
  backend: ConfiguratorBackend,
  input: CreateConfigurationInput,
  reading: Promise<ConfigurationChoices | null>,
  ctx: ConfiguratorContext,
): Promise<ReplayedConfiguration> {
  const [created, choices] = await Promise.all([
    backend.create(input, ctx),
    reading,
  ]);

  const defaults = { configuration: created, replayed: false };
  if (!choices) return defaults;
  const changes = replayChanges(choices, created);
  if (!changes) return defaults;
  if (changes.length === 0) {
    return { configuration: created, replayed: landed(choices, created) };
  }

  const applied = await backend
    .applyChanges(created.configurationId, changes, ctx)
    .catch(() => null);
  if (applied && landed(choices, applied)) {
    return { configuration: applied, replayed: true };
  }
  // A refused batch fails whole, a timed-out one may not have, and an accepted
  // one can leave a pick unselected: the session is not the defaults either way.
  await backend.release(created.configurationId, ctx).catch(() => {});
  return { configuration: await backend.create(input, ctx), replayed: false };
}

/** A new session of one for the product, holding the order row's choices. */
export function replayOrderLine(
  backend: ConfiguratorBackend,
  input: { productId: string; publicOrderId: string; row: number },
  ctx: ConfiguratorContext,
): Promise<ReplayedConfiguration> {
  const reading = backend
    .orderLineChoices(input.publicOrderId, input.row, ctx)
    .then((choices) =>
      choices && String(choices.productId) === input.productId ? choices : null,
    )
    .catch(() => null);
  return replayChoices(
    backend,
    { productId: input.productId, quantity: 1 },
    reading,
    ctx,
  );
}

/**
 * A new session holding the choices of one that expired on the product page,
 * at the quantity it held.
 */
export function restoreConfiguration(
  backend: ConfiguratorBackend,
  { productId, quantity, variables, options }: RestoreConfigurationInput,
  ctx: ConfiguratorContext,
): Promise<ReplayedConfiguration> {
  return replayChoices(
    backend,
    { productId, quantity },
    Promise.resolve({ variables, options }),
    ctx,
  );
}
