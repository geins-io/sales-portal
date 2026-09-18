import { describe, it, expect } from 'vitest';
import type {
  ConfigurationOption,
  ConfigurationOptionGroup,
  ConfigurationVariable,
} from '#shared/types/configurator';
import {
  isGroupUnmet,
  isVariableUnmet,
} from '../../../shared/utils/configurator-requirement';

// ---------------------------------------------------------------------------
// The one place that says what "missing" means. Both the fixture engine, which
// decides whether a document is valid, and the specification panel, which names
// what is left to answer, read it — so the two boundaries below are asserted
// here rather than only through whatever a component happens to render.
// ---------------------------------------------------------------------------

function group(
  options: Pick<ConfigurationOption, 'selected'>[],
  minSelections?: number,
): Pick<ConfigurationOptionGroup, 'minSelections' | 'options'> {
  return {
    minSelections,
    options: options as ConfigurationOption[],
  };
}

function variable(
  value: ConfigurationVariable['value'],
  required = true,
): Pick<ConfigurationVariable, 'required' | 'value'> {
  return { required, value };
}

describe('isGroupUnmet', () => {
  it('is unmet while a required group has nothing chosen', () => {
    expect(isGroupUnmet(group([{ selected: false }], 1))).toBe(true);
  });

  it('is met once the group has what it asks for', () => {
    expect(isGroupUnmet(group([{ selected: true }], 1))).toBe(false);
  });

  it('counts a selected option the rules made unavailable', () => {
    // It is part of the configuration until the provider says otherwise, and
    // the specification rows count it the same way.
    const chosen = { selected: true, available: false };
    expect(isGroupUnmet(group([chosen], 1))).toBe(false);
  });

  it('asks nothing of a group with no minimum', () => {
    expect(isGroupUnmet(group([{ selected: false }]))).toBe(false);
  });

  it('is not unmet when a group holds more than its maximum', () => {
    // "Missing before you can continue" is the sentence an unmet group feeds;
    // an overfull group is missing nothing, and a provider that objects says so
    // in a message.
    const full = group([{ selected: true }, { selected: true }], 1);
    expect(isGroupUnmet(full)).toBe(false);
  });

  it('counts each selection against a minimum above one', () => {
    expect(isGroupUnmet(group([{ selected: true }], 2))).toBe(true);
    expect(
      isGroupUnmet(group([{ selected: true }, { selected: true }], 2)),
    ).toBe(false);
  });
});

describe('isVariableUnmet', () => {
  it('is unmet while a required variable is empty', () => {
    expect(isVariableUnmet(variable(null))).toBe(true);
    expect(isVariableUnmet(variable(''))).toBe(true);
  });

  it('treats a zero and an unticked box as answers', () => {
    // Every seeded variable starts at 0 and is required: counting a zero as
    // missing would make both fixture products invalid on arrival.
    expect(isVariableUnmet(variable(0))).toBe(false);
    expect(isVariableUnmet(variable(false))).toBe(false);
  });

  it('asks nothing of a variable the provider does not require', () => {
    expect(isVariableUnmet(variable(null, false))).toBe(false);
  });

  it('is met by a value of any other kind', () => {
    expect(isVariableUnmet(variable(1200))).toBe(false);
    expect(isVariableUnmet(variable('Engraved'))).toBe(false);
    expect(isVariableUnmet(variable(true))).toBe(false);
  });
});
