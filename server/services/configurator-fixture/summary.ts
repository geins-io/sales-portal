import type {
  Configuration,
  ConfigurationSummaryLine,
} from '#shared/types/configurator';
import { everyOption, everyVariable } from './document';
import { exVatAmount } from '#shared/utils/configurator-price';
import { seedPrice } from './seed/builders';
import type { Seed } from './seed/types';

// ---------------------------------------------------------------------------
// What a committed configuration shows on a cart line.
//
// One row per selected option and one per variable the buyer moved off its
// default — a configured result has no article number of its own, so these rows
// are the only description of what was ordered.
// ---------------------------------------------------------------------------

function display(value: unknown, unit?: string): string {
  return unit ? `${String(value)} ${unit}` : String(value);
}

export function buildSummary(
  config: Configuration,
  seed: Seed,
): ConfigurationSummaryLine[] {
  const options = everyOption(config.sections)
    .filter((option) => option.selected)
    .map((option) => ({
      label: option.product.name,
      value: display(option.quantity),
      price: seedPrice(
        exVatAmount(option.unitPrice) * option.quantity,
        seed.vatRate,
        option.discountPercent,
      ),
    }));

  const variables = everyVariable(config.sections)
    .filter((variable) => variable.value !== variable.defaultValue)
    .map((variable) => {
      const rate = seed.variableRates[variable.id];
      const delta =
        rate !== undefined &&
        typeof variable.value === 'number' &&
        typeof variable.defaultValue === 'number'
          ? rate * (variable.value - variable.defaultValue)
          : 0;
      return {
        label: variable.name,
        value: display(variable.value, variable.unit),
        ...(delta === 0 ? {} : { price: seedPrice(delta, seed.vatRate) }),
      };
    });

  return [...options, ...variables];
}
