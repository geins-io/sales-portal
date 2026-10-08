import { describe, it, expect } from 'vitest';
import type {
  LineConfigurationGroup,
  LineConfigurationSection,
  LineConfigurationVariable,
  PriceType,
} from '#shared/types/commerce';
import type { Configuration } from '#shared/types/configurator';
import {
  collectBlockingItems,
  collectBlockingMessages,
  committedSpecificationRows,
  groupSpecificationRows,
  lineSpecificationTotals,
  panelTotals,
  specificationRows,
  specificationText,
  unnamedBlockingMessages,
  type SpecificationRow,
  type SpecificationValue,
} from '../../app/utils/configurator-panel';
import {
  findOption,
  findOptionGroup,
  findVariable,
  makeCabinetConfiguration,
  makeInitialConfiguration,
  makeInvalidConfiguration,
  makeSectionTreeConfiguration,
  makeValidConfiguration,
} from '../fixtures/configurator';

describe('collectBlockingMessages', () => {
  it('finds the error the provider put on an option group', () => {
    const config = makeInitialConfiguration();
    findOptionGroup(config, 'color').messages = [
      { severity: 'error', text: 'That finish is out of production.' },
    ];
    expect(collectBlockingMessages(config)).toEqual([
      'That finish is out of production.',
    ]);
  });

  it('finds nothing in a document whose only fault is an unanswered group', () => {
    // An unmet requirement is a property of the group; no sentence is written
    // for it, so there is nothing here to find.
    expect(collectBlockingMessages(makeInvalidConfiguration())).toEqual([]);
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

/** The banner's lines, by name alone, for the cases where only that matters. */
function blockingNames(config: Configuration): string[] {
  return collectBlockingItems(config).map((item) => item.name);
}

describe('collectBlockingItems, what is named', () => {
  it('names the group a fresh document is waiting on', () => {
    expect(blockingNames(makeInitialConfiguration())).toEqual(['Colour']);
  });

  it('names both empty groups of an incomplete document, in document order', () => {
    expect(blockingNames(makeInvalidConfiguration())).toEqual([
      'Table top',
      'Colour',
    ]);
  });

  it('names what is missing in the order the page shows it', () => {
    const config = makeCabinetConfiguration();
    findOption(config, 'mount-wall').selected = false;
    findOption(config, 'door-glass').selected = false;
    findVariable(config, 'cab-width').value = null;
    findVariable(config, 'cab-height').value = null;

    // The seed interleaves this section, so the order below is neither of the
    // two lists: groups first would read Mounting, Doors, Width, Height. A
    // buyer working down the banner meets them where they sit on the page.
    expect(blockingNames(config)).toEqual([
      'Mounting',
      'Width',
      'Height',
      'Doors',
    ]);
  });

  it('names nothing in a complete document', () => {
    expect(blockingNames(makeValidConfiguration())).toEqual([]);
  });

  it('names a required variable left empty, and not one resting at zero', () => {
    const config = makeValidConfiguration();
    expect(findVariable(config, 'shelves').value).toBe(0);
    expect(blockingNames(config)).toEqual([]);

    findVariable(config, 'width').value = null;
    expect(blockingNames(config)).toEqual(['Width']);
  });

  it('names a group inside a group', () => {
    const config = makeValidConfiguration();
    const legs = findOptionGroup(config, 'legs');
    legs.optionGroups = [
      {
        ...legs,
        id: 'legs-mounting',
        name: 'Mounting',
        minSelections: 1,
        optionGroups: [],
        options: [],
        messages: [],
      },
    ];
    expect(blockingNames(config)).toEqual(['Mounting']);
  });

  it('does not name a group that has what it asks for, whatever it says', () => {
    // A rule conflict belongs beside its group, not in a sentence about what
    // the buyer has left to answer.
    const config = makeValidConfiguration();
    findOptionGroup(config, 'color').messages = [
      { severity: 'error', text: 'That finish is out of production.' },
    ];
    expect(blockingNames(config)).toEqual([]);
  });

  it('counts a selected option the rules made unavailable as an answer', () => {
    // The specification counts it as chosen; the banner must agree, or it asks
    // for something that is already there.
    const config = makeValidConfiguration();
    findOption(config, 'ral-9005').available = false;
    expect(blockingNames(config)).toEqual([]);
  });

  it('does not name a group that has too many selections', () => {
    // "Missing before you can continue" is the sentence; an overfull group is
    // missing nothing, and a provider that objects says so in a message.
    const config = makeValidConfiguration();
    const colour = findOptionGroup(config, 'color');
    colour.maxSelections = 1;
    findOption(config, 'ral-9010').selected = true;
    expect(blockingNames(config)).toEqual([]);
  });

  it('names nothing inside a section the provider hid', () => {
    // Its rules still ran and the document's own verdict weighs them; the
    // banner points at what is on screen, and naming a hidden group would ask
    // the buyer to fix something they cannot reach.
    const config = makeInitialConfiguration();
    expect(blockingNames(config)).toEqual(['Colour']);

    config.sections[0]!.sections[0]!.visible = false;
    expect(blockingNames(config)).toEqual([]);
  });

  it('does not name a required variable the provider made unavailable', () => {
    // Measured on the real provider: a requirement that does not apply to the
    // current choices arrives empty and unavailable, in a valid document.
    const config = makeValidConfiguration();
    const width = findVariable(config, 'width');
    width.value = null;
    width.available = false;
    expect(blockingNames(config)).toEqual([]);
  });

  it('does not name an unavailable group short of its minimum', () => {
    const config = makeInitialConfiguration();
    expect(blockingNames(config)).toEqual(['Colour']);

    findOptionGroup(config, 'color').available = false;
    expect(blockingNames(config)).toEqual([]);
  });

  it('names nothing for an error the document carries itself', () => {
    // A message names nothing at all now; `unnamedBlockingMessages` shows it.
    const config = makeValidConfiguration({
      messages: [{ severity: 'error', text: 'The template is out of date.' }],
    });
    expect(blockingNames(config)).toEqual([]);
  });
});

describe('collectBlockingItems, where each item is', () => {
  it('names a group with the section that holds it, however deep', () => {
    // Colour sits in Finish, which nests inside Frame: the link opens the
    // page the group is on, not its parent.
    expect(collectBlockingItems(makeInitialConfiguration())).toEqual([
      { name: 'Colour', sectionId: 'finish', kind: 'group', nodeId: 'color' },
    ]);
  });

  it('names a variable with its section and its own id', () => {
    const config = makeValidConfiguration();
    findVariable(config, 'width').value = null;

    expect(collectBlockingItems(config)).toEqual([
      { name: 'Width', sectionId: 'frame', kind: 'variable', nodeId: 'width' },
    ]);
  });

  it('takes the section of the innermost page, two levels down', () => {
    const config = makeSectionTreeConfiguration();
    const industrial = findOptionGroup(config, 'industrial');
    industrial.minSelections = 1;
    for (const option of industrial.options) option.selected = false;

    expect(
      collectBlockingItems(config).find((item) => item.nodeId === 'industrial'),
    ).toEqual({
      name: industrial.name,
      sectionId: 'edge-trim',
      kind: 'group',
      nodeId: 'industrial',
    });
  });

  it("names a group inside a group by its own id, in the outer group's section", () => {
    const config = makeValidConfiguration();
    const legs = findOptionGroup(config, 'legs');
    legs.optionGroups = [
      {
        ...legs,
        id: 'legs-mounting',
        name: 'Mounting',
        minSelections: 1,
        optionGroups: [],
        options: [],
        messages: [],
      },
    ];

    expect(collectBlockingItems(config)).toEqual([
      {
        name: 'Mounting',
        sectionId: 'frame',
        kind: 'group',
        nodeId: 'legs-mounting',
      },
    ]);
  });

  it('lists every missing node in the order the page shows them', () => {
    expect(
      collectBlockingItems(makeInvalidConfiguration()).map(
        (item) => item.nodeId,
      ),
    ).toEqual(['top', 'color']);
  });

  it('skips a section the provider hid', () => {
    const config = makeInitialConfiguration();
    config.sections[0]!.sections[0]!.visible = false;

    expect(collectBlockingItems(config)).toEqual([]);
  });

  it('keeps the first of two nodes that share a name', () => {
    // One line per name, as the sentence had; the link goes to the first.
    const config = makeInitialConfiguration();
    const width = findVariable(config, 'width');
    width.value = null;
    width.name = 'Colour';

    expect(collectBlockingItems(config)).toEqual([
      { name: 'Colour', sectionId: 'frame', kind: 'variable', nodeId: 'width' },
    ]);
  });
});

describe('unnamedBlockingMessages', () => {
  it('keeps a generic sentence an option carries even when a named group says the same', () => {
    // A provider reuses one wording everywhere. Subtracting by text dropped
    // the option's copy as if the group's name stood for it, and an option
    // contributes no name — so nothing on screen mentioned it at all.
    const config = makeInitialConfiguration();
    findOptionGroup(config, 'color').messages = [
      { severity: 'error', text: 'Selection required' },
    ];
    findOption(config, 'acc-power').messages = [
      { severity: 'error', text: 'Selection required' },
    ];

    expect(blockingNames(config)).toEqual(['Colour']);
    expect(unnamedBlockingMessages(config)).toEqual(['Selection required']);
  });

  it('says nothing about a section the provider hid', () => {
    const config = makeValidConfiguration();
    const finish = config.sections[0]!.sections[0]!;
    finish.visible = false;
    finish.messages = [
      { severity: 'error', text: 'The finish is unavailable.' },
    ];

    expect(unnamedBlockingMessages(config)).toEqual([]);
    expect(collectBlockingMessages(config)).toEqual([]);
  });

  it('drops the message of a group the banner already names', () => {
    const config = makeInvalidConfiguration();
    findOptionGroup(config, 'top').messages = [
      { severity: 'error', text: 'Pick a variant.' },
    ];
    expect(blockingNames(config)).toEqual(['Table top', 'Colour']);
    expect(unnamedBlockingMessages(config)).toEqual([]);
  });

  it('keeps the message of a group that has what it asks for', () => {
    const config = makeValidConfiguration();
    findOptionGroup(config, 'color').messages = [
      { severity: 'error', text: 'That finish is out of production.' },
    ];
    expect(unnamedBlockingMessages(config)).toEqual([
      'That finish is out of production.',
    ]);
  });

  it('keeps the error the document carries itself', () => {
    const config = makeInvalidConfiguration({
      messages: [{ severity: 'error', text: 'The template is out of date.' }],
    });
    expect(unnamedBlockingMessages(config)).toEqual([
      'The template is out of date.',
    ]);
  });

  it('keeps a section error, which has no name in the sentence', () => {
    const config = makeValidConfiguration();
    config.sections[0]!.messages = [
      { severity: 'error', text: 'The frame is incomplete.' },
    ];
    expect(unnamedBlockingMessages(config)).toEqual([
      'The frame is incomplete.',
    ]);
  });

  it('keeps an error on a single option', () => {
    const config = makeValidConfiguration();
    findOption(config, 'legs-fixed').messages = [
      { severity: 'error', text: 'The fixed frame is discontinued.' },
    ];
    expect(unnamedBlockingMessages(config)).toEqual([
      'The fixed frame is discontinued.',
    ]);
  });

  it('keeps the message of a variable the banner does not name', () => {
    const config = makeValidConfiguration();
    findVariable(config, 'width').messages = [
      { severity: 'error', text: 'The width is out of range.' },
    ];
    expect(blockingNames(config)).toEqual([]);
    expect(unnamedBlockingMessages(config)).toEqual([
      'The width is out of range.',
    ]);
  });
});

describe('specificationRows', () => {
  it('groups every choice by the section it was made in, nested sections of their own', () => {
    const rows = specificationRows(makeValidConfiguration());
    expect(rows.map((row) => [row.group, row.label])).toEqual([
      ['Frame', 'Leg frame'],
      ['Frame', 'Width'],
      ['Frame', 'Depth'],
      ['Finish', 'Table top'],
      ['Finish', 'Colour'],
    ]);
  });

  it('reads an interleaved section in the order the indices give', () => {
    const rows = specificationRows(makeCabinetConfiguration());

    // A list, two fields, a list, a field — the arrangement the merchant
    // built, not the two arrays the document happens to carry it in.
    expect(
      rows.filter((row) => row.group === 'Cabinet').map((row) => row.label),
    ).toEqual(['Mounting', 'Width', 'Height', 'Doors', 'Front area']);
  });

  it('leaves out a variable the provider made unavailable, even one holding a value', () => {
    // The form hides the field, so the panel must not show what it held: a
    // provider can send a placeholder mask as the value of a closed field.
    const config = makeValidConfiguration();
    const width = findVariable(config, 'width');
    width.available = false;

    const labels = specificationRows(config).map((row) => row.label);
    expect(width.value).not.toBeNull();
    expect(labels).not.toContain('Width');
    expect(labels).toContain('Depth');
  });

  it('carries the option name, its quantity and its price', () => {
    const config = makeValidConfiguration();
    const rows = specificationRows(config);
    expect(rows.find((row) => row.label === 'Colour')).toEqual({
      id: 'group:color',
      group: 'Finish',
      label: 'Colour',
      values: [
        {
          text: 'Black (RAL 9005)',
          quantity: 1,
          price: findOption(config, 'ral-9005').unitPrice,
        },
      ],
    });
  });

  it('gives a multi-select one value per selected option', () => {
    const config = makeValidConfiguration();
    const pegboard = findOption(config, 'acc-pegboard');
    pegboard.selected = true;
    pegboard.quantity = 2;
    findOption(config, 'acc-light').selected = true;

    const row = specificationRows(config).find(
      (candidate) => candidate.label === 'Accessories',
    );
    expect(row?.values).toEqual([
      {
        text: 'Tool pegboard',
        quantity: 2,
        price: pegboard.unitPrice,
      },
      {
        text: 'LED light bar',
        quantity: 1,
        price: findOption(config, 'acc-light').unitPrice,
      },
    ]);
  });

  it('keeps a selected option the rules made unavailable', () => {
    // It is part of the configuration whatever the rules now say about it, and
    // a specification that drops it describes something the buyer did not
    // build.
    const config = makeValidConfiguration();
    findOption(config, 'ral-9005').available = false;

    const row = specificationRows(config).find(
      (candidate) => candidate.label === 'Colour',
    );
    expect(row?.values.map((value) => value.text)).toEqual([
      'Black (RAL 9005)',
    ]);
  });

  it('leaves out a group nothing is selected in', () => {
    const rows = specificationRows(makeValidConfiguration());
    expect(rows.map((row) => row.label)).not.toContain('Accessories');
  });

  // The prototype preselects "Inget valt" in a group the buyer may skip, so
  // its specification names that choice rather than leaving the group out.
  it('specifies an optional single choice left at nothing chosen as "none"', () => {
    const config = makeValidConfiguration();
    const top = findOptionGroup(config, 'top');
    top.minSelections = undefined;
    for (const option of top.options) option.selected = false;

    expect(
      specificationRows(config).find((row) => row.label === 'Table top'),
    ).toEqual({
      id: 'group:top',
      group: 'Finish',
      label: 'Table top',
      values: [{ none: true }],
    });
  });

  it('specifies the chosen option of an optional single choice, not "none"', () => {
    const config = makeValidConfiguration();
    findOptionGroup(config, 'top').minSelections = 0;

    expect(
      specificationRows(config).find((row) => row.label === 'Table top')
        ?.values,
    ).toEqual([
      {
        text: 'Laminate top',
        quantity: 1,
        price: findOption(config, 'top-laminate').unitPrice,
      },
    ]);
  });

  it('leaves out a required single choice nothing is chosen in', () => {
    const config = makeValidConfiguration();
    for (const option of findOptionGroup(config, 'top').options)
      option.selected = false;

    expect(specificationRows(config).map((row) => row.label)).not.toContain(
      'Table top',
    );
  });

  it('gives a group inside a group a row of its own', () => {
    const config = makeValidConfiguration();
    const legs = findOptionGroup(config, 'legs');
    const option = legs.options[0];
    expect(option).toBeDefined();
    legs.optionGroups = [
      {
        ...legs,
        id: 'legs-mounting',
        name: 'Mounting',
        optionGroups: [],
        options: [{ ...option!, id: 'legs-wall', selected: true }],
      },
    ];

    const rows = specificationRows(config);
    expect(rows.map((row) => row.label)).toEqual([
      'Leg frame',
      'Mounting',
      'Width',
      'Depth',
      'Table top',
      'Colour',
    ]);
  });

  it('carries a variable as its number, its decimals and its unit', () => {
    // The number is handed over unformatted: how it is written depends on the
    // locale, which a pure function has no business holding.
    const rows = specificationRows(makeValidConfiguration());
    expect(rows.find((row) => row.label === 'Width')?.values).toEqual([
      { number: 1200, decimals: 0, unit: 'mm' },
    ]);
  });

  it('keys a row by its node, so a group and a variable cannot collide', () => {
    const rows = specificationRows(makeValidConfiguration());
    expect(rows.map((row) => row.id)).toEqual([
      'group:legs',
      'variable:width',
      'variable:depth',
      'group:top',
      'group:color',
    ]);
  });

  it('leaves the unit out of a variable that has none', () => {
    const config = makeValidConfiguration();
    const width = findVariable(config, 'width');
    width.unit = undefined;

    expect(
      specificationRows(config).find((row) => row.label === 'Width')?.values,
    ).toEqual([{ number: 1200, decimals: 0 }]);
  });

  it('carries the decimals the provider asked for', () => {
    const config = makeValidConfiguration();
    const width = findVariable(config, 'width');
    width.decimals = 1;
    width.value = 12.5;

    expect(
      specificationRows(config).find((row) => row.label === 'Width')?.values,
    ).toEqual([{ number: 12.5, decimals: 1, unit: 'mm' }]);
  });

  it('leaves out a variable resting at nothing', () => {
    // Shelves and the oversize margin are optional and sit at zero in every
    // example document: nothing was chosen, so there is nothing to state.
    const rows = specificationRows(makeValidConfiguration());
    const labels = rows.map((row) => row.label);
    expect(labels).not.toContain('Shelves');
    expect(labels).not.toContain('Oversize margin');
  });

  it('leaves out an empty text variable and keeps one that holds a word', () => {
    const config = makeValidConfiguration();
    const width = findVariable(config, 'width');
    width.valueType = 'string';
    width.unit = undefined;
    width.value = '';
    expect(specificationRows(config).some((row) => row.label === 'Width')).toBe(
      false,
    );

    width.value = 'Engraved';
    expect(
      specificationRows(config).find((row) => row.label === 'Width')?.values,
    ).toEqual([{ text: 'Engraved' }]);
  });

  it('leaves out a variable that holds no value at all', () => {
    const config = makeValidConfiguration();
    const width = findVariable(config, 'width');
    width.value = null;
    expect(specificationRows(config).some((row) => row.label === 'Width')).toBe(
      false,
    );
  });

  it('hands a boolean to the locale files, and leaves out an unticked one', () => {
    // A pure function has no locale, so the word is the component's to write.
    const config = makeValidConfiguration();
    const width = findVariable(config, 'width');
    width.valueType = 'boolean';
    width.unit = undefined;
    width.value = true;
    expect(
      specificationRows(config).find((row) => row.label === 'Width')?.values,
    ).toEqual([{ boolValue: true }]);

    width.value = false;
    expect(specificationRows(config).some((row) => row.label === 'Width')).toBe(
      false,
    );
  });

  it('keeps a boolean whole even where the variable carries a unit', () => {
    // A unit belongs to a number; appending it to a word the component has not
    // written yet would read "undefined mm".
    const config = makeValidConfiguration();
    const width = findVariable(config, 'width');
    width.valueType = 'boolean';
    width.value = true;
    expect(
      specificationRows(config).find((row) => row.label === 'Width')?.values,
    ).toEqual([{ boolValue: true }]);
  });

  it('renders nothing from a section the provider hid', () => {
    const config = makeValidConfiguration();
    config.sections[0]!.visible = false;
    expect(specificationRows(config)).toEqual([]);
  });
});

describe('committedSpecificationRows', () => {
  const PRICE: PriceType = {
    sellingPriceExVat: 619.49,
    currency: { code: 'SEK' },
  };

  function section(
    name: string,
    parts: Partial<LineConfigurationSection> = {},
  ): LineConfigurationSection {
    return {
      name,
      sortIndex: null,
      variables: [],
      optionGroups: [],
      sections: [],
      ...parts,
    };
  }

  function group(
    id: string,
    parts: Partial<LineConfigurationGroup> = {},
  ): LineConfigurationGroup {
    return {
      id,
      name: id,
      sortIndex: null,
      options: [{ name: `${id} pick` }],
      optionGroups: [],
      ...parts,
    };
  }

  function variable(
    id: string,
    parts: Partial<LineConfigurationVariable> = {},
  ): LineConfigurationVariable {
    return { id, name: id, sortIndex: null, value: 'x', ...parts };
  }

  const ids = (sections: LineConfigurationSection[]) =>
    committedSpecificationRows(sections).map((row) => row.id);

  it('gives a group one row, one value per option, with its quantity and price', () => {
    expect(
      committedSpecificationRows([
        section('Machine', {
          optionGroups: [
            group('teeth', {
              name: 'Bucket teeth',
              options: [
                { name: 'J250', quantity: 4, unitPrice: PRICE },
                { name: 'J300' },
              ],
            }),
          ],
        }),
      ]),
    ).toStrictEqual([
      {
        id: 'group:teeth',
        group: 'Machine',
        label: 'Bucket teeth',
        values: [{ text: 'J250', quantity: 4, price: PRICE }, { text: 'J300' }],
      },
    ]);
  });

  it("merges a section's groups and variables by index, null last", () => {
    expect(
      ids([
        section('S', {
          optionGroups: [
            group('g-none'),
            group('g-3', { sortIndex: 3 }),
            group('g-1', { sortIndex: 1 }),
          ],
          variables: [variable('v-2', { sortIndex: 2 }), variable('v-none')],
        }),
      ]),
    ).toEqual([
      'group:g-1',
      'variable:v-2',
      'group:g-3',
      'group:g-none',
      'variable:v-none',
    ]);
  });

  it('puts groups before variables where the index ties or is absent', () => {
    expect(
      ids([
        section('S', {
          optionGroups: [group('g', { sortIndex: 1 })],
          variables: [variable('v', { sortIndex: 1 })],
        }),
        section('T', {
          optionGroups: [group('h')],
          variables: [variable('w')],
        }),
      ]),
    ).toEqual(['group:g', 'variable:v', 'group:h', 'variable:w']);
  });

  it('orders sibling sections by index, null last, each heading its own rows', () => {
    const rows = committedSpecificationRows([
      section('Last', { optionGroups: [group('c')] }),
      section('Second', { sortIndex: 5, optionGroups: [group('b')] }),
      section('First', { sortIndex: 2, optionGroups: [group('a')] }),
    ]);

    expect(rows.map((row) => [row.group, row.id])).toEqual([
      ['First', 'group:a'],
      ['Second', 'group:b'],
      ['Last', 'group:c'],
    ]);
  });

  it("puts a nested section after its parent's members, its children in index order", () => {
    const rows = committedSpecificationRows([
      section('Outer', {
        optionGroups: [group('outer', { sortIndex: 1 })],
        sections: [
          section('Inner B', { sortIndex: 2, optionGroups: [group('b')] }),
          section('Inner A', { sortIndex: 1, optionGroups: [group('a')] }),
        ],
        variables: [variable('v', { sortIndex: 9 })],
      }),
    ]);

    expect(rows.map((row) => [row.group, row.id])).toEqual([
      ['Outer', 'group:outer'],
      ['Outer', 'variable:v'],
      ['Inner A', 'group:a'],
      ['Inner B', 'group:b'],
    ]);
  });

  it('puts a nested group after its parent, siblings in index order', () => {
    expect(
      ids([
        section('S', {
          optionGroups: [
            group('parent', {
              optionGroups: [
                group('late', { sortIndex: 2 }),
                group('early', { sortIndex: 1 }),
              ],
            }),
            group('next', { sortIndex: 1 }),
          ],
        }),
      ]),
    ).toEqual(['group:next', 'group:parent', 'group:early', 'group:late']);
  });

  it('gives a group with no option no row, but keeps the groups under it', () => {
    expect(
      ids([
        section('S', {
          optionGroups: [
            group('empty', { options: [], optionGroups: [group('child')] }),
          ],
        }),
      ]),
    ).toEqual(['group:child']);
  });

  it('writes a variable as the specification does, and leaves out one that holds nothing', () => {
    const rows = committedSpecificationRows([
      section('S', {
        variables: [
          variable('width', {
            value: 1200.5,
            unit: 'mm',
            decimals: 1,
            sortIndex: 1,
          }),
          variable('painted', { value: true, sortIndex: 2 }),
          variable('label', { value: 'Hall 2', unit: 'm', sortIndex: 3 }),
          variable('zero', { value: 0 }),
          variable('unticked', { value: false }),
          variable('empty', { value: '' }),
          variable('unset', { value: null }),
        ],
      }),
    ]);

    expect(rows).toEqual([
      {
        id: 'variable:width',
        group: 'S',
        label: 'width',
        values: [{ number: 1200.5, decimals: 1, unit: 'mm' }],
      },
      {
        id: 'variable:painted',
        group: 'S',
        label: 'painted',
        values: [{ boolValue: true }],
      },
      {
        id: 'variable:label',
        group: 'S',
        label: 'label',
        values: [{ text: 'Hall 2', unit: 'm' }],
      },
    ]);
  });

  it('answers no rows for a structure with nothing in it', () => {
    expect(committedSpecificationRows([])).toEqual([]);
    expect(committedSpecificationRows([section('Empty')])).toEqual([]);
  });
});

describe('lineSpecificationTotals', () => {
  it("reads the amounts from the line's total and the rate from one unit", () => {
    expect(
      lineSpecificationTotals(
        { sellingPriceExVat: 2118.94, vat: 402.6, sellingPriceIncVat: 2521.54 },
        {
          sellingPriceExVat: 6356.82,
          vat: 1207.8,
          sellingPriceIncVat: 7564.62,
        },
      ),
    ).toEqual({ net: 6356.82, vat: 1207.8, incVat: 7564.62, ratePercent: 19 });
  });

  it('answers no rate where the unit has nothing to divide by', () => {
    expect(
      lineSpecificationTotals(
        { sellingPriceExVat: 0, vat: 0 },
        { sellingPriceExVat: 0, vat: 0, sellingPriceIncVat: 0 },
      )?.ratePercent,
    ).toBeNull();
  });

  it('answers nothing for a line without a total', () => {
    expect(lineSpecificationTotals(undefined, undefined)).toBeNull();
    expect(
      lineSpecificationTotals({ sellingPriceExVat: 1, vat: 0.25 }, undefined),
    ).toBeNull();
  });
});

describe('groupSpecificationRows', () => {
  it('keeps the order the groups first appear in', () => {
    const rows: SpecificationRow[] = [
      { id: 'group:color', group: 'Finish', label: 'Colour', values: [] },
      { id: 'group:legs', group: 'Frame', label: 'Legs', values: [] },
      { id: 'group:top', group: 'Finish', label: 'Table top', values: [] },
    ];
    expect(
      groupSpecificationRows(rows).map(([group, grouped]) => [
        group,
        grouped.map((row) => row.label),
      ]),
    ).toEqual([
      ['Finish', ['Colour', 'Table top']],
      ['Frame', ['Legs']],
    ]);
  });
});

describe('specificationText', () => {
  const rows: SpecificationRow[] = [
    {
      id: 'group:legs',
      group: 'Frame',
      label: 'Leg frame',
      values: [
        {
          text: 'Electric height legs',
          price: { sellingPriceExVat: 4200, currency: { code: 'SEK' } },
        },
      ],
    },
    {
      id: 'variable:width',
      group: 'Frame',
      label: 'Width',
      values: [{ text: '1200 mm' }],
    },
    {
      id: 'group:color',
      group: 'Finish',
      label: 'Colour',
      values: [
        {
          text: 'Black (RAL 9005)',
          price: { sellingPriceExVat: 0, currency: { code: 'SEK' } },
        },
      ],
    },
  ];

  const formatValue = (value: SpecificationValue) => value.text ?? '';
  const formatPrice = (price: PriceType) =>
    price.sellingPriceExVat ? `+${price.sellingPriceExVat} kr` : null;

  it('writes the product, the quantity, the groups and their rows', () => {
    const text = specificationText({
      productName: 'Arbetsbord Pro',
      articleNumber: 'KONF-1001',
      quantityLine: 'Antal: 2 st',
      rows,
      formatValue,
      formatPrice,
      price: {
        lines: [
          { label: 'Nettopris', amount: '7 400 kr' },
          { label: 'Moms (25%)', amount: '1 850 kr' },
          { label: 'Inkl. moms', amount: '9 250 kr' },
        ],
        note: 'Indikativt pris.',
      },
    });

    expect(text).toBe(
      [
        'Arbetsbord Pro (KONF-1001)',
        'Antal: 2 st',
        '',
        'FRAME',
        '  Leg frame:',
        '    Electric height legs  (+4200 kr)',
        '  Width:',
        '    1200 mm',
        '',
        'FINISH',
        '  Colour:',
        '    Black (RAL 9005)',
        '',
        'Nettopris: 7 400 kr',
        'Moms (25%): 1 850 kr',
        'Inkl. moms: 9 250 kr',
        'Indikativt pris.',
      ].join('\n'),
    );
  });

  it('leaves the price out when the buyer may not see one', () => {
    const text = specificationText({
      productName: 'Arbetsbord Pro',
      articleNumber: 'KONF-1001',
      quantityLine: 'Antal: 1 st',
      rows,
      formatValue,
      formatPrice,
    });

    expect(text).not.toContain('Nettopris');
    expect(text).toContain('  Colour:');
  });
});

describe('panelTotals', () => {
  // Amounts that do not add up prove each total is its own amount times the
  // quantity, never derived from another.
  function pricedAt(quantity: number): Configuration {
    const config = makeValidConfiguration();
    config.quantity = quantity;
    config.unitPrice = {
      sellingPriceExVat: 1000,
      sellingPriceIncVat: 1300,
      vat: 120,
      currency: { code: 'SEK' },
    };
    return config;
  }

  it('answers the unit amounts at quantity 1', () => {
    expect(panelTotals(pricedAt(1))).toEqual({
      net: 1000,
      vat: 120,
      incVat: 1300,
    });
  });

  it('multiplies each amount by the quantity', () => {
    expect(panelTotals(pricedAt(3))).toEqual({
      net: 3000,
      vat: 360,
      incVat: 3900,
    });
  });

  it('multiplies the unrounded unit amount, as the cart line does', () => {
    const config = pricedAt(3);
    config.unitPrice = { sellingPriceExVat: 2118.9384230567 };
    expect(panelTotals(config)?.net).toBeCloseTo(6356.815269, 6);
  });

  it('counts an amount the price leaves out as zero', () => {
    const config = pricedAt(3);
    config.unitPrice = { sellingPriceExVat: 1000 };
    expect(panelTotals(config)).toEqual({ net: 3000, vat: 0, incVat: 0 });
  });

  it('answers nothing for a configuration without a unit price', () => {
    const config = pricedAt(3);
    Reflect.deleteProperty(config, 'unitPrice');
    expect(panelTotals(config)).toBeNull();
  });

  it('answers nothing without a configuration', () => {
    expect(panelTotals(null)).toBeNull();
  });
});
