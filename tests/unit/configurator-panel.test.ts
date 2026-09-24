import { describe, it, expect } from 'vitest';
import type { PriceType } from '#shared/types/commerce';
import {
  collectBlockingMessages,
  collectBlockingNames,
  formatRemaining,
  groupSpecificationRows,
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

describe('collectBlockingNames', () => {
  it('names the group a fresh document is waiting on', () => {
    expect(collectBlockingNames(makeInitialConfiguration())).toEqual([
      'Colour',
    ]);
  });

  it('names both empty groups of an incomplete document, in document order', () => {
    expect(collectBlockingNames(makeInvalidConfiguration())).toEqual([
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
    expect(collectBlockingNames(config)).toEqual([
      'Mounting',
      'Width',
      'Height',
      'Doors',
    ]);
  });

  it('names nothing in a complete document', () => {
    expect(collectBlockingNames(makeValidConfiguration())).toEqual([]);
  });

  it('names a required variable left empty, and not one resting at zero', () => {
    const config = makeValidConfiguration();
    expect(findVariable(config, 'shelves').value).toBe(0);
    expect(collectBlockingNames(config)).toEqual([]);

    findVariable(config, 'width').value = null;
    expect(collectBlockingNames(config)).toEqual(['Width']);
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
    expect(collectBlockingNames(config)).toEqual(['Mounting']);
  });

  it('does not name a group that has what it asks for, whatever it says', () => {
    // A rule conflict belongs beside its group, not in a sentence about what
    // the buyer has left to answer.
    const config = makeValidConfiguration();
    findOptionGroup(config, 'color').messages = [
      { severity: 'error', text: 'That finish is out of production.' },
    ];
    expect(collectBlockingNames(config)).toEqual([]);
  });

  it('counts a selected option the rules made unavailable as an answer', () => {
    // The specification counts it as chosen; the banner must agree, or it asks
    // for something that is already there.
    const config = makeValidConfiguration();
    findOption(config, 'ral-9005').available = false;
    expect(collectBlockingNames(config)).toEqual([]);
  });

  it('does not name a group that has too many selections', () => {
    // "Missing before you can continue" is the sentence; an overfull group is
    // missing nothing, and a provider that objects says so in a message.
    const config = makeValidConfiguration();
    const colour = findOptionGroup(config, 'color');
    colour.maxSelections = 1;
    findOption(config, 'ral-9010').selected = true;
    expect(collectBlockingNames(config)).toEqual([]);
  });

  it('names nothing inside a section the provider hid', () => {
    // Its rules still ran and the document's own verdict weighs them; the
    // banner points at what is on screen, and naming a hidden group would ask
    // the buyer to fix something they cannot reach.
    const config = makeInitialConfiguration();
    expect(collectBlockingNames(config)).toEqual(['Colour']);

    config.sections[0]!.sections[0]!.visible = false;
    expect(collectBlockingNames(config)).toEqual([]);
  });

  it('names nothing for an error the document carries itself', () => {
    // A message names nothing at all now; `unnamedBlockingMessages` shows it.
    const config = makeValidConfiguration({
      messages: [{ severity: 'error', text: 'The template is out of date.' }],
    });
    expect(collectBlockingNames(config)).toEqual([]);
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

    expect(collectBlockingNames(config)).toEqual(['Colour']);
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
    expect(collectBlockingNames(config)).toEqual(['Table top', 'Colour']);
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
    expect(collectBlockingNames(config)).toEqual([]);
    expect(unnamedBlockingMessages(config)).toEqual([
      'The width is out of range.',
    ]);
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
        label: 'Nettopris',
        amount: '7 400 kr',
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
