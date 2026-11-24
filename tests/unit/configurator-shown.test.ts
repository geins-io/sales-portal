import { describe, it, expect } from 'vitest';
import type {
  Configuration,
  ConfigurationOption,
  ConfigurationOptionGroup,
  ConfigurationSection,
  ConfigurationVariable,
} from '../../shared/types/configurator';
import { shownConfiguration } from '../../app/utils/configurator-shown';
import { selectionLimit } from '../../app/utils/configurator-form';
import {
  blockedOnlyByHiddenChoices,
  blockedOnlyByHiddenSections,
  collectBlockingItems,
  specificationRows,
} from '../../app/utils/configurator-panel';
import { flattenVisibleSections } from '../../app/utils/configurator-sections';

// ---------------------------------------------------------------------------
// The document as the buyer is shown it when the store hides what cannot be
// chosen. Built from the smallest nodes that carry each question; the two
// shapes the real provider sends for a group with nothing to choose are named
// after what was measured: the whole group unavailable (A), or an available
// group whose every row is unavailable (B).
// ---------------------------------------------------------------------------

function option(
  id: string,
  parts: Partial<ConfigurationOption> = {},
): ConfigurationOption {
  return {
    id,
    instanceId: '0',
    articleNumber: `ART-${id}`,
    name: id,
    description: '',
    selected: false,
    available: true,
    readOnly: false,
    selectionSource: 'none',
    quantity: 1,
    defaultQuantity: 1,
    unitPrice: { sellingPriceExVat: 0, currency: { code: 'SEK' } },
    discountPercent: 0,
    messages: [],
    product: null,
    ...parts,
  };
}

function group(
  id: string,
  parts: Partial<ConfigurationOptionGroup> = {},
): ConfigurationOptionGroup {
  return {
    id,
    code: id.toUpperCase(),
    name: id,
    description: '',
    available: true,
    minSelections: 1,
    maxSelections: 1,
    quantityEditable: false,
    optionGroups: [],
    options: [],
    messages: [],
    ...parts,
  };
}

function variable(
  id: string,
  parts: Partial<ConfigurationVariable> = {},
): ConfigurationVariable {
  return {
    id,
    name: id,
    description: '',
    valueType: 'string',
    value: null,
    defaultValue: null,
    required: false,
    available: true,
    readOnly: false,
    selectionSource: 'none',
    valueSource: 'initial',
    messages: [],
    ...parts,
  };
}

function section(
  id: string,
  parts: Partial<ConfigurationSection> = {},
): ConfigurationSection {
  return {
    id,
    name: id,
    description: '',
    visible: true,
    sections: [],
    variables: [],
    optionGroups: [],
    messages: [],
    ...parts,
  };
}

function doc(
  sections: ConfigurationSection[],
  parts: Partial<Configuration> = {},
): Configuration {
  return {
    configurationId: 'c',
    expiresAt: '2030-01-01T00:00:00.000Z',
    isValid: true,
    articleNumber: 'A',
    quantity: 1,
    unitPrice: { sellingPriceExVat: 100, currency: { code: 'SEK' } },
    discountPercent: 0,
    templateId: 't',
    templateVersion: '1',
    messages: [],
    sections,
    ...parts,
  };
}

/** Shape A: the provider closed the group itself. */
const closedGroup = (
  id: string,
  parts: Partial<ConfigurationOptionGroup> = {},
) =>
  group(id, {
    available: false,
    options: [
      option(`${id}-1`, { available: false }),
      option(`${id}-2`, { available: false }),
    ],
    ...parts,
  });

/** Shape B: the group is open, every row in it is not. */
const emptiedGroup = (
  id: string,
  parts: Partial<ConfigurationOptionGroup> = {},
) =>
  group(id, {
    options: [option(`${id}-1`, { available: false })],
    ...parts,
  });

const openGroup = (id: string, parts: Partial<ConfigurationOptionGroup> = {}) =>
  group(id, { options: [option(`${id}-1`), option(`${id}-2`)], ...parts });

const shown = (config: Configuration) => shownConfiguration(config, true);

const groupIds = (s: ConfigurationSection | undefined): string[] =>
  s?.optionGroups.map((g) => g.id) ?? [];

const optionIds = (g: ConfigurationOptionGroup | undefined): string[] =>
  g?.options.map((o) => o.id) ?? [];

describe('shownConfiguration', () => {
  it('returns the document itself when the store shows everything', () => {
    const config = doc([section('s', { optionGroups: [closedGroup('a')] })]);
    expect(shownConfiguration(config, false)).toBe(config);
  });

  it('leaves the document it was given untouched', () => {
    const config = doc([
      section('s', { optionGroups: [openGroup('o'), closedGroup('a')] }),
    ]);
    const before = structuredClone(config);
    shown(config);
    expect(config).toEqual(before);
  });

  it('drops a row that cannot be chosen and keeps the ones that can', () => {
    const config = doc([
      section('s', {
        optionGroups: [
          group('g', {
            options: [option('yes'), option('no', { available: false })],
          }),
        ],
      }),
    ]);
    expect(optionIds(shown(config).sections[0]?.optionGroups[0])).toEqual([
      'yes',
    ]);
  });

  it('keeps a chosen row the rules have since made unavailable', () => {
    const config = doc([
      section('s', {
        optionGroups: [
          group('g', {
            options: [
              option('chosen', { available: false, selected: true }),
              option('other', { available: false }),
            ],
          }),
        ],
      }),
    ]);
    const g = shown(config).sections[0]?.optionGroups[0];
    expect(optionIds(g)).toEqual(['chosen']);
  });

  it('keeps a read-only row: it is available, only not the buyer’s to change', () => {
    const config = doc([
      section('s', {
        optionGroups: [
          group('g', { options: [option('ro', { readOnly: true })] }),
        ],
      }),
    ]);
    expect(optionIds(shown(config).sections[0]?.optionGroups[0])).toEqual([
      'ro',
    ]);
  });

  it('drops a group the provider closed (shape A)', () => {
    const config = doc([
      section('s', { optionGroups: [openGroup('o'), closedGroup('a')] }),
    ]);
    expect(groupIds(shown(config).sections[0])).toEqual(['o']);
  });

  it('drops an open group whose every row is unavailable (shape B)', () => {
    const config = doc([
      section('s', { optionGroups: [openGroup('o'), emptiedGroup('b')] }),
    ]);
    expect(groupIds(shown(config).sections[0])).toEqual(['o']);
  });

  it('drops the available rows of a closed group: the group answers for them', () => {
    const config = doc([
      section('s', {
        optionGroups: [
          openGroup('o'),
          group('a', { available: false, options: [option('row')] }),
        ],
      }),
    ]);
    expect(groupIds(shown(config).sections[0])).toEqual(['o']);
  });

  it('keeps a closed group that holds a choice, with only that choice', () => {
    const config = doc([
      section('s', {
        optionGroups: [
          closedGroup('a', {
            options: [
              option('kept', { available: false, selected: true }),
              option('gone', { available: false }),
              option('also-gone'),
            ],
          }),
        ],
      }),
    ]);
    const g = shown(config).sections[0]?.optionGroups[0];
    expect(g?.id).toBe('a');
    expect(optionIds(g)).toEqual(['kept']);
  });

  it('drops a group whose only rows say nothing a buyer could choose by', () => {
    const config = doc([
      section('s', {
        optionGroups: [
          openGroup('o'),
          group('blank', {
            options: [option('x', { name: ' ', articleNumber: '' })],
          }),
        ],
      }),
    ]);
    expect(groupIds(shown(config).sections[0])).toEqual(['o']);
  });

  it('drops a group with nothing in it at all', () => {
    const config = doc([
      section('s', { optionGroups: [openGroup('o'), group('empty')] }),
    ]);
    expect(groupIds(shown(config).sections[0])).toEqual(['o']);
  });

  describe('nested groups', () => {
    it('drops a nested group with nothing to choose, and keeps its parent', () => {
      const config = doc([
        section('s', {
          optionGroups: [
            openGroup('parent', {
              optionGroups: [openGroup('child'), closedGroup('closed')],
            }),
          ],
        }),
      ]);
      const parent = shown(config).sections[0]?.optionGroups[0];
      expect(parent?.optionGroups.map((g) => g.id)).toEqual(['child']);
    });

    it('drops a parent with no rows once every nested group is gone', () => {
      const config = doc([
        section('s', {
          optionGroups: [
            openGroup('o'),
            group('parent', {
              optionGroups: [closedGroup('a'), emptiedGroup('b')],
            }),
          ],
        }),
      ]);
      expect(groupIds(shown(config).sections[0])).toEqual(['o']);
    });

    it('keeps a parent with no choice of its own when a nested group holds one', () => {
      const config = doc([
        section('s', {
          optionGroups: [
            group('parent', {
              options: [option('p', { available: false })],
              optionGroups: [
                group('child', {
                  options: [option('c', { selected: true })],
                }),
              ],
            }),
          ],
        }),
      ]);
      const parent = shown(config).sections[0]?.optionGroups[0];
      expect(parent?.id).toBe('parent');
      expect(optionIds(parent)).toEqual([]);
      expect(parent?.optionGroups.map((g) => g.id)).toEqual(['child']);
    });

    it('drops a closed parent and every nested group when none holds a choice', () => {
      const config = doc([
        section('s', {
          optionGroups: [
            openGroup('o'),
            closedGroup('parent', { optionGroups: [openGroup('child')] }),
          ],
        }),
      ]);
      expect(groupIds(shown(config).sections[0])).toEqual(['o']);
    });

    it('keeps a closed parent while a nested group holds a choice, with only that choice', () => {
      const config = doc([
        section('s', {
          optionGroups: [
            closedGroup('parent', {
              optionGroups: [
                openGroup('chosen-child', {
                  options: [option('c', { selected: true }), option('d')],
                }),
                openGroup('other-child'),
              ],
            }),
          ],
        }),
      ]);
      const parent = shown(config).sections[0]?.optionGroups[0];
      expect(parent?.id).toBe('parent');
      expect(optionIds(parent)).toEqual([]);
      expect(parent?.optionGroups.map((g) => g.id)).toEqual(['chosen-child']);
      expect(optionIds(parent?.optionGroups[0])).toEqual(['c']);
    });

    it('closes a group two levels below a closed one', () => {
      const config = doc([
        section('s', {
          optionGroups: [
            openGroup('o'),
            closedGroup('top', {
              options: [],
              optionGroups: [
                group('middle', { optionGroups: [openGroup('bottom')] }),
              ],
            }),
          ],
        }),
      ]);
      expect(groupIds(shown(config).sections[0])).toEqual(['o']);
    });
  });

  describe('sections', () => {
    it('hides a section left with nothing to show', () => {
      const config = doc([
        section('kept', { optionGroups: [openGroup('o')] }),
        section('emptied', { optionGroups: [closedGroup('a')] }),
      ]);
      const out = shown(config);
      expect(out.sections.map((s) => [s.id, s.visible])).toEqual([
        ['kept', true],
        ['emptied', false],
      ]);
    });

    it('hides a section whose only content is variables that are not available', () => {
      const config = doc([
        section('kept', { optionGroups: [openGroup('o')] }),
        section('vars', {
          variables: [variable('v', { available: false })],
        }),
      ]);
      expect(shown(config).sections[1]?.visible).toBe(false);
    });

    it('keeps a section that shows a variable, and leaves variables as sent', () => {
      const vars = [variable('v'), variable('w', { available: false })];
      const config = doc([
        section('s', { variables: vars, optionGroups: [closedGroup('a')] }),
      ]);
      const out = shown(config).sections[0];
      expect(out?.visible).toBe(true);
      expect(out?.variables).toEqual(vars);
    });

    it('keeps a section whose own content is gone while a child section shows something', () => {
      const config = doc([
        section('menu', {
          optionGroups: [closedGroup('a')],
          sections: [section('child', { optionGroups: [openGroup('o')] })],
        }),
      ]);
      const menu = shown(config).sections[0];
      expect(menu?.visible).toBe(true);
      expect(menu?.sections[0]?.visible).toBe(true);
    });

    it('hides a parent once its only child section is emptied too', () => {
      const config = doc([
        section('kept', { optionGroups: [openGroup('o')] }),
        section('parent', {
          sections: [section('child', { optionGroups: [closedGroup('a')] })],
        }),
      ]);
      const parent = shown(config).sections[1];
      expect(parent?.visible).toBe(false);
      expect(parent?.sections[0]?.visible).toBe(false);
    });

    it('leaves a section the provider hid exactly as sent', () => {
      const hidden = section('hidden', {
        visible: false,
        optionGroups: [closedGroup('a')],
        sections: [section('child', { optionGroups: [closedGroup('b')] })],
      });
      const config = doc([
        section('s', { optionGroups: [openGroup('o')] }),
        hidden,
      ]);
      expect(shown(config).sections[1]).toBe(hidden);
    });

    it('takes the emptied section out of the rail and numbers what is left', () => {
      const config = doc([
        section('one', { optionGroups: [openGroup('o1')] }),
        section('two', { optionGroups: [closedGroup('a')] }),
        section('three', { optionGroups: [openGroup('o3')] }),
      ]);
      const rail = flattenVisibleSections(shown(config).sections);
      expect(rail.map((e) => [e.section.id, e.number])).toEqual([
        ['one', '1'],
        ['three', '2'],
      ]);
    });
  });

  it('drops the "n/max" line once the cap no longer limits the rows shown', () => {
    const config = doc([
      section('s', {
        optionGroups: [
          group('multi', {
            minSelections: 0,
            maxSelections: 2,
            options: [
              option('a'),
              option('b'),
              option('c', { available: false }),
            ],
          }),
        ],
      }),
    ]);
    const raw = config.sections[0]?.optionGroups[0];
    const out = shown(config).sections[0]?.optionGroups[0];
    if (!raw || !out) throw new Error('missing group');
    expect(selectionLimit(raw)).toEqual({ count: 0, max: 2 });
    expect(selectionLimit(out)).toBeUndefined();
  });

  it('leaves a skippable group the buyer never saw out of the specification', () => {
    const config = doc([
      section('s', {
        optionGroups: [
          openGroup('o', { options: [option('pick', { selected: true })] }),
          closedGroup('skippable', { minSelections: 0 }),
        ],
      }),
    ]);
    expect(specificationRows(config).map((r) => r.id)).toEqual([
      'group:o',
      'group:skippable',
    ]);
    expect(specificationRows(shown(config)).map((r) => r.id)).toEqual([
      'group:o',
    ]);
  });
});

describe('blockedOnlyByHiddenChoices', () => {
  /** The real case: required, open, its only row closed by an earlier choice. */
  const hinges = () => emptiedGroup('hinges');

  it('is true when the only thing missing is a required group the setting hid', () => {
    const config = doc(
      [
        section('s', {
          optionGroups: [
            openGroup('done', { options: [option('d', { selected: true })] }),
            hinges(),
          ],
        }),
      ],
      { isValid: false },
    );
    expect(collectBlockingItems(config).map((i) => i.name)).toEqual(['hinges']);
    const out = shown(config);
    expect(collectBlockingItems(out)).toEqual([]);
    expect(blockedOnlyByHiddenChoices(out, config)).toBe(true);
  });

  it('is false while the buyer still has a missing choice they can see', () => {
    const config = doc(
      [section('s', { optionGroups: [openGroup('todo'), hinges()] })],
      { isValid: false },
    );
    const out = shown(config);
    expect(collectBlockingItems(out).map((i) => i.name)).toEqual(['todo']);
    expect(blockedOnlyByHiddenChoices(out, config)).toBe(false);
  });

  it('is false with the setting off: the group is on show and named', () => {
    const config = doc([section('s', { optionGroups: [hinges()] })], {
      isValid: false,
    });
    expect(blockedOnlyByHiddenChoices(config, config)).toBe(false);
  });

  it('is false for a valid document', () => {
    const config = doc([section('s', { optionGroups: [hinges()] })]);
    expect(blockedOnlyByHiddenChoices(shown(config), config)).toBe(false);
  });

  it('is false when a message the buyer can read is left to show', () => {
    const config = doc([section('s', { optionGroups: [hinges()] })], {
      isValid: false,
      messages: [{ severity: 'error', text: 'Root says no.' }],
    });
    expect(blockedOnlyByHiddenChoices(shown(config), config)).toBe(false);
  });

  it('is false when nothing unmet was hidden: the document is invalid for another reason', () => {
    const config = doc(
      [
        section('s', {
          optionGroups: [
            closedGroup('a'),
            openGroup('o', { options: [option('x', { selected: true })] }),
          ],
        }),
      ],
      { isValid: false },
    );
    expect(blockedOnlyByHiddenChoices(shown(config), config)).toBe(false);
  });

  it('gives way to a section the provider hid: that one cannot be reached at all', () => {
    const config = doc(
      [
        section('s', { optionGroups: [hinges()] }),
        section('provider-hidden', {
          visible: false,
          optionGroups: [openGroup('unreachable')],
        }),
      ],
      { isValid: false },
    );
    const out = shown(config);
    expect(blockedOnlyByHiddenSections(out)).toBe(true);
    expect(blockedOnlyByHiddenChoices(out, config)).toBe(false);
  });
});
