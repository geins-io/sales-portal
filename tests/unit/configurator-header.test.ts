import { describe, it, expect } from 'vitest';
import {
  collectBlockingMessages,
  formatRemaining,
} from '../../app/utils/configurator-header';
import {
  findOption,
  findOptionGroup,
  findVariable,
  makeInitialConfiguration,
  makeInvalidConfiguration,
  makeValidConfiguration,
} from '../fixtures/configurator';

describe('collectBlockingMessages', () => {
  it('finds the error the provider put on an option group', () => {
    // The only thing wrong with a fresh document: the colour group is empty.
    expect(collectBlockingMessages(makeInitialConfiguration())).toEqual([
      'Select a colour.',
    ]);
  });

  it('finds both group errors in an incomplete document', () => {
    expect(collectBlockingMessages(makeInvalidConfiguration())).toEqual([
      'Select a table top.',
      'Select a colour.',
    ]);
  });

  it('finds nothing in a complete document', () => {
    expect(collectBlockingMessages(makeValidConfiguration())).toEqual([]);
  });

  it('reads the root message the example documents never carry', () => {
    // Every fixture has an empty root; the contract puts messages there, so a
    // walk that skips it would be proved by nothing.
    const config = makeValidConfiguration({
      messages: [{ severity: 'error', text: 'The template is out of date.' }],
    });
    expect(collectBlockingMessages(config)).toEqual([
      'The template is out of date.',
    ]);
  });

  it('reads a section message', () => {
    const config = makeValidConfiguration();
    config.sections[0]!.messages = [
      { severity: 'error', text: 'The frame is incomplete.' },
    ];
    expect(collectBlockingMessages(config)).toEqual([
      'The frame is incomplete.',
    ]);
  });

  it('reads a nested section message', () => {
    const config = makeValidConfiguration();
    const nested = config.sections[0]!.sections[0];
    expect(nested).toBeDefined();
    nested!.messages = [{ severity: 'error', text: 'Pick a finish.' }];
    expect(collectBlockingMessages(config)).toEqual(['Pick a finish.']);
  });

  it('reads a variable message', () => {
    const config = makeValidConfiguration();
    findVariable(config, 'width').messages = [
      { severity: 'error', text: 'The width is out of range.' },
    ];
    expect(collectBlockingMessages(config)).toEqual([
      'The width is out of range.',
    ]);
  });

  it('reads a message on an option', () => {
    const config = makeValidConfiguration();
    findOption(config, 'legs-fixed').messages = [
      { severity: 'error', text: 'The fixed frame is discontinued.' },
    ];
    expect(collectBlockingMessages(config)).toEqual([
      'The fixed frame is discontinued.',
    ]);
  });

  it('reads a message on a group inside a group', () => {
    const config = makeValidConfiguration();
    // No example document nests one option group in another — the contract
    // allows it and the provider will, so the recursion is built by hand here
    // or nothing proves it.
    const legs = findOptionGroup(config, 'legs');
    legs.optionGroups = [
      {
        ...legs,
        id: 'legs-mounting',
        optionGroups: [],
        options: [],
        messages: [{ severity: 'error', text: 'Pick a mounting.' }],
      },
    ];
    expect(collectBlockingMessages(config)).toEqual(['Pick a mounting.']);
  });

  it('reads a message on an option of a group inside a group', () => {
    const config = makeValidConfiguration();
    const legs = findOptionGroup(config, 'legs');
    const option = legs.options[0];
    expect(option).toBeDefined();
    legs.optionGroups = [
      {
        ...legs,
        id: 'legs-mounting',
        optionGroups: [],
        options: [
          {
            ...option!,
            id: 'legs-wall',
            messages: [{ severity: 'error', text: 'Wall mounting is gone.' }],
          },
        ],
        messages: [],
      },
    ];
    expect(collectBlockingMessages(config)).toEqual(['Wall mounting is gone.']);
  });

  it('ignores a warning', () => {
    const config = makeValidConfiguration();
    findOption(config, 'acc-power').messages = [
      { severity: 'warning', text: 'Electric legs require a power strip.' },
    ];
    expect(collectBlockingMessages(config)).toEqual([]);
  });

  it('returns the same sentence once when two nodes carry it', () => {
    const config = makeValidConfiguration();
    const repeated = { severity: 'error' as const, text: 'Pick a variant.' };
    findOptionGroup(config, 'top').messages = [repeated];
    findOptionGroup(config, 'color').messages = [repeated];
    expect(collectBlockingMessages(config)).toEqual(['Pick a variant.']);
  });

  it('keeps two different sentences in document order', () => {
    const config = makeValidConfiguration({
      messages: [{ severity: 'error', text: 'First.' }],
    });
    findOptionGroup(config, 'color').messages = [
      { severity: 'error', text: 'Second.' },
    ];
    expect(collectBlockingMessages(config)).toEqual(['First.', 'Second.']);
  });
});

describe('formatRemaining', () => {
  it('pads the seconds', () => {
    expect(formatRemaining(64_000)).toBe('1:04');
  });

  it('renders a whole minute', () => {
    expect(formatRemaining(120_000)).toBe('2:00');
  });

  it('drops the part of a second that is not yet whole', () => {
    expect(formatRemaining(59_999)).toBe('0:59');
  });

  it('floors at zero for an elapsed session', () => {
    expect(formatRemaining(0)).toBe('0:00');
    expect(formatRemaining(-5_000)).toBe('0:00');
  });

  it('keeps counting in minutes past an hour', () => {
    // A session lasts minutes, so an hours field would be a branch no
    // document can reach.
    expect(formatRemaining(3_904_000)).toBe('65:04');
  });
});
