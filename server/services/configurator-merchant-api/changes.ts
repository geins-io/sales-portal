import type { ConfigurationChange } from '#shared/types/configurator';
import type { ConfigurationChangeInputType } from '@geins/types';

/**
 * Our change as the SDK's input type takes it. Each kind sends only its own
 * fields, and a variable's value goes as it is: `CpqValue` takes the same
 * string, number, boolean or null the document reads back.
 */
export function toWireChange(
  change: ConfigurationChange,
): ConfigurationChangeInputType {
  switch (change.type) {
    case 'variable':
      return {
        type: 'VARIABLE',
        variableId: change.variableId,
        value: change.value,
      };
    case 'option':
      return {
        type: 'OPTION',
        optionId: change.optionId,
        instanceId: change.instanceId,
        selected: change.selected,
        ...(change.quantity !== undefined && { quantity: change.quantity }),
        lock: LOCKS[change.lock],
      };
    case 'quantity':
      return { type: 'QUANTITY', quantity: change.quantity };
  }
}

const LOCKS = {
  none: 'NONE',
  lock: 'LOCK',
  unlock: 'UNLOCK',
} as const;
