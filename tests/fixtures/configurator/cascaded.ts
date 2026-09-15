import type { Configuration } from '#shared/types/configurator';
import { CURRENCY, findOption, findVariable } from './builders';
import { BASE_PRICE, makeInitialConfiguration } from './initial';

// ---------------------------------------------------------------------------
// The initial document after two changes: the leg frame set to electric, then
// the table top to stainless steel. Everything else is untouched, so a diff
// against `makeInitialConfiguration()` shows the cascade and nothing else —
// which is what makes this document useful as a reference.
//
// Three outcomes, in one document, because that is how they arrive: the whole
// re-evaluated state comes back on every change.
//
//   electric legs  -> acc-power selected by a group rule, with the reason
//   electric legs  -> acc-castors unavailable, with the reason
//   steel top      -> width narrowed to max 1600
//
// The colour group is still empty, so the document is still invalid.
//
// The rows the two changes deselect keep the `selectionSource` they were
// created with rather than reporting the rule that dropped them: measured
// against a live install, a deselected row returns to its creation value and a
// deselection never reports as manual.
//
// Not covered here: the provider also clamps a width above the narrowed max
// and adds a warning to the variable. Reaching that state needs a third change
// (a width above 1600 before the top is switched), which would break the
// one-diff property above. The fixture engine covers it instead.
// ---------------------------------------------------------------------------

export function makeCascadedConfiguration(
  overrides: Partial<Configuration> = {},
): Configuration {
  const config = makeInitialConfiguration();

  const legsFixed = findOption(config, 'legs-fixed');
  legsFixed.selected = false;
  legsFixed.selectionSource = 'initial';

  const legsElectric = findOption(config, 'legs-electric');
  legsElectric.selected = true;
  legsElectric.selectionSource = 'manual';

  const power = findOption(config, 'acc-power');
  power.selected = true;
  power.selectionSource = 'groupRule';
  power.messages = [
    { severity: 'warning', text: 'Electric legs require a power strip.' },
  ];

  const castors = findOption(config, 'acc-castors');
  castors.available = false;
  castors.messages = [
    {
      severity: 'warning',
      text: 'Braked castors cannot be combined with electric legs.',
    },
  ];

  const topLaminate = findOption(config, 'top-laminate');
  topLaminate.selected = false;
  topLaminate.selectionSource = 'initial';

  const topSteel = findOption(config, 'top-steel');
  topSteel.selected = true;
  topSteel.selectionSource = 'manual';

  findVariable(config, 'width').max = 1600;

  config.unitPrice = {
    net:
      BASE_PRICE +
      legsElectric.unitPrice.net +
      power.unitPrice.net +
      topSteel.unitPrice.net,
    currency: CURRENCY,
  };

  return { ...config, ...overrides };
}
