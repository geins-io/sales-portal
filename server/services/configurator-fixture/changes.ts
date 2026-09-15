import type {
  Configuration,
  ConfigurationChange,
  ConfigurationOption,
  ConfigurationValue,
  ConfigurationVariable,
} from '#shared/types/configurator';
import { findGroupOf, findOption, findVariable, optionKey } from './document';
import { cloneSessionState, evaluate, type SessionState } from './evaluate';
import type { Seed } from './seed/types';

// ---------------------------------------------------------------------------
// A change batch onto the session state.
//
// The batch is whole or nothing: everything is checked against the current
// document first, and only then is anything written. A batch that is half
// applied would leave the buyer looking at a document nobody asked for, and the
// UI replaces its whole state from the response — it has nothing to fall back
// to.
// ---------------------------------------------------------------------------

function refuse(reason: string): never {
  throw createAppError(ErrorCode.VALIDATION_ERROR, reason);
}

function checkVariable(
  config: Configuration,
  change: Extract<ConfigurationChange, { type: 'variable' }>,
): ConfigurationVariable {
  const variable = findVariable(config, change.variableId);
  if (!variable) refuse(`No variable '${change.variableId}'`);
  // A variable the provider owns — one it computes, or one it pinned — arrives
  // locked, which is also how the UI knows not to offer it.
  if (variable.selectionSource === 'locked' || !variable.available) {
    refuse(`'${variable.id}' cannot be set`);
  }
  if (variable.valueType === 'string' && typeof change.value !== 'string') {
    refuse(`'${variable.id}' takes text`);
  }
  if (variable.valueType === 'number') {
    if (typeof change.value !== 'number') {
      refuse(`'${variable.id}' takes a number`);
    }
    const below = variable.min !== undefined && change.value < variable.min;
    const above = variable.max !== undefined && change.value > variable.max;
    if (below || above) refuse(`'${variable.id}' is out of range`);
  }
  return variable;
}

function checkOption(
  config: Configuration,
  change: Extract<ConfigurationChange, { type: 'option' }>,
): ConfigurationOption {
  const option = findOption(config, change.optionId, change.instanceId);
  if (!option) refuse(`No option '${change.optionId}'`);
  if (option.selectionSource === 'locked') refuse(`'${option.id}' is locked`);
  if (!option.available) refuse(`'${option.id}' is not available`);
  // The provider lets a buyer pin a row against the rules. The fixture does
  // not, and says so rather than dropping the flag silently.
  if (change.lock !== 'none') refuse('The fixture cannot pin a row');
  const min = option.minQuantity ?? 1;
  const max = option.maxQuantity;
  if (change.quantity < min || (max !== undefined && change.quantity > max)) {
    refuse(`'${option.id}' cannot be ordered in that quantity`);
  }
  return option;
}

/**
 * Selecting inside a single-select group drops whatever else was selected
 * there. The dropped rows are written into the state as deselected so the
 * evaluation does not put the seed's own default back.
 */
function deselectSiblings(
  config: Configuration,
  next: SessionState,
  option: ConfigurationOption,
): void {
  const group = findGroupOf(config, option.id);
  if (group?.maxSelections !== 1) return;
  for (const sibling of group.options) {
    if (sibling.instanceId === option.instanceId && sibling.id === option.id) {
      continue;
    }
    next.options.set(optionKey(sibling.id, sibling.instanceId), {
      selected: false,
      quantity: sibling.defaultQuantity,
    });
  }
}

/** A change that passed its checks, holding the node it resolved to. */
type CheckedChange =
  | { kind: 'quantity'; quantity: number }
  | { kind: 'variable'; id: string; value: ConfigurationValue }
  | {
      kind: 'option';
      option: ConfigurationOption;
      selected: boolean;
      quantity: number;
    };

function check(
  config: Configuration,
  change: ConfigurationChange,
): CheckedChange {
  if (change.type === 'variable') {
    const variable = checkVariable(config, change);
    return { kind: 'variable', id: variable.id, value: change.value };
  }
  if (change.type === 'option') {
    return {
      kind: 'option',
      option: checkOption(config, change),
      selected: change.selected,
      quantity: change.quantity,
    };
  }
  if (change.quantity < 1) refuse('A quantity starts at one');
  return { kind: 'quantity', quantity: change.quantity };
}

export function applyChangeBatch(
  seed: Seed,
  state: SessionState,
  session: { configurationId: string; expiresAt: string },
  changes: ConfigurationChange[],
): SessionState {
  const config = evaluate(seed, state, session);
  const checked = changes.map((change) => check(config, change));

  const next = cloneSessionState(state);
  for (const change of checked) {
    if (change.kind === 'quantity') {
      next.quantity = change.quantity;
    } else if (change.kind === 'variable') {
      next.variables.set(change.id, change.value);
    } else {
      if (change.selected) deselectSiblings(config, next, change.option);
      next.options.set(optionKey(change.option.id, change.option.instanceId), {
        selected: change.selected,
        quantity: change.quantity,
      });
    }
  }

  return next;
}
