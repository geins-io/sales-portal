import type {
  ConfigurationOptionGroup,
  ConfigurationVariable,
} from '#shared/types/configurator';

// ---------------------------------------------------------------------------
// What a configuration is still waiting for.
//
// Shared between the fixture engine, which decides whether a document is valid,
// and the specification panel, which names what the buyer has left to do. One
// rule in one place: a requirement is a property of the node, not a sentence
// someone wrote, so neither side reads it out of a message — and a client that
// derived it differently from the server would name something while the
// document called itself valid.
// ---------------------------------------------------------------------------

/**
 * Whether the group is still short of the selections it requires.
 *
 * An absent `minSelections` is a group that requires nothing. A selected option
 * the rules made unavailable still counts as chosen, exactly as the
 * specification counts it: it is part of the configuration until the provider
 * says otherwise.
 *
 * Too many selections is not this: a group over its `maxSelections` is not
 * missing anything, the UI cannot produce one, and a provider that objects says
 * so in a message.
 */
export function isGroupUnmet(
  group: Pick<ConfigurationOptionGroup, 'minSelections' | 'options'>,
): boolean {
  const required = group.minSelections ?? 0;
  const selected = group.options.filter((option) => option.selected).length;
  // No early return for a group that requires nothing: `selected < 0` answers
  // it, and a branch that changes no outcome is one nothing can prove.
  return selected < required;
}

/**
 * Whether a required variable is still empty.
 *
 * Empty is `null` or the empty string, and nothing else. `0` and `false` are
 * answers: every seeded variable starts at `0` and is required, so counting a
 * zero as missing would make both fixture products invalid on arrival. A value
 * outside its bounds is a different question, and the provider's to raise.
 *
 * The panel hides a `0`, a `false` and an empty string from the specification;
 * that is a rule about what is worth writing down, not about what is missing.
 */
export function isVariableUnmet(
  variable: Pick<ConfigurationVariable, 'required' | 'value'>,
): boolean {
  if (!variable.required) return false;
  return variable.value === null || variable.value === '';
}
