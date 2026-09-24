import { describe, it, expect } from 'vitest';
import type {
  Configuration,
  ConfigurationOption,
  ConfigurationOptionGroup,
  ConfigurationSection,
} from '#shared/types/configurator';
import {
  makeInitialConfiguration,
  makeCascadedConfiguration,
  makeInvalidConfiguration,
  findOption,
  findOptionGroup,
  findVariable,
} from '../../fixtures/configurator';

// ---------------------------------------------------------------------------
// The three example documents are reference data for every later configurator
// test, so the states they claim to capture are asserted here rather than
// trusted. The types are checked by `pnpm typecheck` (tests/ is a project of
// the root tsconfig); this file checks the values.
// ---------------------------------------------------------------------------

function everySection(config: Configuration): ConfigurationSection[] {
  const collect = (sections: ConfigurationSection[]): ConfigurationSection[] =>
    sections.flatMap((section) => [section, ...collect(section.sections)]);
  return collect(config.sections);
}

function everyOption(config: Configuration): ConfigurationOption[] {
  const fromGroups = (
    groups: ConfigurationOptionGroup[],
  ): ConfigurationOption[] =>
    groups.flatMap((group) => [
      ...group.options,
      ...fromGroups(group.optionGroups),
    ]);
  return everySection(config).flatMap((section) =>
    fromGroups(section.optionGroups),
  );
}

describe('the initial configuration', () => {
  it('is a fresh document on every call', () => {
    const first = makeInitialConfiguration();
    findOption(first, 'legs-electric').selected = true;

    expect(
      findOption(makeInitialConfiguration(), 'legs-electric').selected,
    ).toBe(false);
  });

  it('is invalid because a required option group is empty', () => {
    const config = makeInitialConfiguration();
    const colour = findOptionGroup(config, 'color');

    expect(config.isValid).toBe(false);
    expect(colour.minSelections).toBe(1);
    expect(colour.options.some((option) => option.selected)).toBe(false);
    // The requirement is the whole reason, and it is the group's own property:
    // nothing is written under a group the buyer has not reached yet.
    expect(colour.messages).toEqual([]);
  });

  it('is priced and has a live session', () => {
    const config = makeInitialConfiguration();

    expect(config.unitPrice).toMatchObject({
      sellingPriceExVat: 3200,
      currency: { code: 'SEK' },
    });
    expect(Date.parse(config.expiresAt)).toBeGreaterThan(Date.now());
  });

  it('has no option that was touched by a rule or by hand', () => {
    const sources = everyOption(makeInitialConfiguration()).map(
      (option) => option.selectionSource,
    );

    expect(sources.length).toBeGreaterThan(0);
    expect(new Set(sources)).toEqual(new Set(['none', 'initial']));
  });
});

describe('the cascaded configuration', () => {
  it('carries all three rule outcomes in the same document', () => {
    const config = makeCascadedConfiguration();
    const power = findOption(config, 'acc-power');
    const castors = findOption(config, 'acc-castors');

    expect(findOption(config, 'legs-electric').selected).toBe(true);
    expect(power.selected).toBe(true);
    expect(power.selectionSource).toBe('groupRule');
    expect(power.messages.length).toBeGreaterThan(0);

    expect(castors.available).toBe(false);
    expect(castors.messages.length).toBeGreaterThan(0);

    expect(findOption(config, 'top-steel').selected).toBe(true);
    expect(findVariable(config, 'width').max).toBe(1600);
  });

  it('differs from the initial document only in the cascaded nodes', () => {
    expect(withoutCascadedNodes(makeCascadedConfiguration())).toEqual(
      withoutCascadedNodes(makeInitialConfiguration()),
    );
  });
});

describe('the invalid configuration', () => {
  it('has a required option group emptied, and says so through the requirement', () => {
    const config = makeInvalidConfiguration();
    const top = findOptionGroup(config, 'top');

    expect(config.isValid).toBe(false);
    expect(top.minSelections).toBe(1);
    expect(top.options.some((option) => option.selected)).toBe(false);
    expect(top.messages).toEqual([]);
  });

  it('carries no message on the root or on any section', () => {
    const config = makeInvalidConfiguration();

    expect(config.messages).toEqual([]);
    for (const section of everySection(config)) {
      expect(section.messages).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// The nodes the cascade is documented to change. Blanking exactly these in both
// documents turns "cascaded is initial plus the cascade and nothing else" into
// a comparison: anything the cascade touched outside this list fails the test.
// ---------------------------------------------------------------------------
const CASCADED_OPTION_IDS = [
  'legs-fixed',
  'legs-electric',
  'top-laminate',
  'top-steel',
  'acc-power',
  'acc-castors',
];

function withoutCascadedNodes(config: Configuration): Configuration {
  const copy = structuredClone(config);

  for (const id of CASCADED_OPTION_IDS) {
    const option = findOption(copy, id);
    option.selected = false;
    option.available = true;
    option.selectionSource = 'none';
    option.messages = [];
  }
  delete findVariable(copy, 'width').max;
  copy.unitPrice = {};

  return copy;
}
