import type {
  Configuration,
  ConfigurationValue,
} from '#shared/types/configurator';
import {
  isGroupUnmet,
  isVariableUnmet,
} from '#shared/utils/configurator-requirement';
import {
  everyGroup,
  everyOption,
  everySection,
  everyVariable,
  optionKey,
} from './document';
import { CURRENCY } from './seed/builders';
import type { Seed } from './seed/types';

// ---------------------------------------------------------------------------
// From session state to a whole document.
//
// A session stores what the buyer chose, never a document it has been mutating.
// Every change batch builds a fresh set of seed nodes and walks them through
// the same five steps, which is what makes "the rules re-run on every change"
// true by construction: a rule outcome cannot outlive the state that caused it,
// because the nodes it wrote on are thrown away.
// ---------------------------------------------------------------------------

export interface OptionState {
  selected: boolean;
  quantity: number;
}

export interface SessionState {
  quantity: number;
  /** Keyed by `optionKey`, so a group can hold the same part twice. */
  options: Map<string, OptionState>;
  variables: Map<string, ConfigurationValue>;
}

export interface SessionIdentity {
  configurationId: string;
  expiresAt: string;
}

export function createSessionState(quantity: number): SessionState {
  return { quantity, options: new Map(), variables: new Map() };
}

export function cloneSessionState(state: SessionState): SessionState {
  return {
    quantity: state.quantity,
    options: new Map(state.options),
    variables: new Map(state.variables),
  };
}

/** Money arithmetic on floats needs a rounding step, or 1.5 × 3 drifts. */
function round(net: number): number {
  return Math.round(net * 100) / 100;
}

function applyState(config: Configuration, state: SessionState): void {
  for (const option of everyOption(config.sections)) {
    const chosen = state.options.get(optionKey(option.id, option.instanceId));
    if (!chosen) continue;
    option.selected = chosen.selected;
    option.quantity = chosen.quantity;
    // A deselected row returns to the source it was created with rather than
    // reporting the act that dropped it — measured against a live install.
    if (chosen.selected) option.selectionSource = 'manual';
  }

  for (const variable of everyVariable(config.sections)) {
    if (!state.variables.has(variable.id)) continue;
    variable.value = state.variables.get(variable.id) ?? null;
    variable.valueSource = 'manual';
  }
}

function applyFormulas(config: Configuration, seed: Seed): void {
  for (const [id, formula] of Object.entries(seed.formulas)) {
    const variable = everyVariable(config.sections).find(
      (candidate) => candidate.id === id,
    );
    if (!variable) continue;
    variable.value = formula(config);
    variable.valueSource = 'formula';
  }
}

function price(config: Configuration, seed: Seed): number {
  const options = everyOption(config.sections)
    .filter((option) => option.selected)
    .reduce((net, option) => net + option.unitPrice.net * option.quantity, 0);

  const variables = everyVariable(config.sections).reduce((net, variable) => {
    const rate = seed.variableRates[variable.id];
    if (
      rate === undefined ||
      typeof variable.value !== 'number' ||
      typeof variable.defaultValue !== 'number'
    ) {
      return net;
    }
    return net + rate * (variable.value - variable.defaultValue);
  }, 0);

  return round(seed.basePrice + options + variables);
}

/**
 * What makes a document invalid: a requirement still unmet, or an error the
 * rules put on any node of the tree.
 *
 * An unmet requirement carries no message of its own. It is a property of the
 * node, which every consumer reads for itself (`isGroupUnmet`,
 * `isVariableUnmet`), and a red box under a group the buyer has not reached yet
 * says only that they have not reached it. Messages are left for what the rules
 * actually have to say — and an error among them still blocks, whatever node it
 * sits on.
 *
 * Hidden sections are weighed too. This is the document's own verdict, not what
 * a page can show: a rule that fires out of sight still decides whether the
 * configuration can be committed.
 */
function validate(config: Configuration): void {
  const sections = config.sections;
  const hasError = [
    config.messages,
    ...everySection(sections).map((section) => section.messages),
    ...everyVariable(sections).map((variable) => variable.messages),
    ...everyGroup(sections).map((group) => group.messages),
    ...everyOption(sections).map((option) => option.messages),
  ].some((messages) =>
    messages.some((message) => message.severity === 'error'),
  );

  config.isValid =
    !everyGroup(sections).some(isGroupUnmet) &&
    !everyVariable(sections).some(isVariableUnmet) &&
    !hasError;
}

export function evaluate(
  seed: Seed,
  state: SessionState,
  session: SessionIdentity,
): Configuration {
  const config: Configuration = {
    configurationId: session.configurationId,
    expiresAt: session.expiresAt,
    isValid: true,
    productId: seed.productId,
    quantity: state.quantity,
    unitPrice: { net: seed.basePrice, currency: CURRENCY },
    discountPercent: 0,
    weightPerUnit: seed.weightPerUnit,
    templateId: seed.templateId,
    templateVersion: seed.templateVersion,
    messages: [],
    sections: seed.buildSections(),
  };

  applyState(config, state);
  applyFormulas(config, seed);
  for (const cascade of seed.cascades) cascade(config);
  config.unitPrice = { net: price(config, seed), currency: CURRENCY };
  validate(config);

  return config;
}
