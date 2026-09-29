import { describe, it, expect } from 'vitest';
import { formatPrice } from '#shared/types/commerce';
import {
  blockingMessage,
  boundsNarrowed,
  boundsParams,
  dateChangeValue,
  dateInputValue,
  emptyStep,
  groupHintKey,
  groupInfoSeverity,
  groupRowCount,
  groupSummary,
  hasImageColumn,
  isReadOnly,
  isSingleSelect,
  matchesOptionQuery,
  messagesBesides,
  offersNoneRow,
  OPTION_CHOOSER_ABOVE,
  optionBlockReason,
  optionImage,
  optionPricePrefix,
  refusesOptionIn,
  refusesVariable,
  signedOptionPrice,
  usesChooser,
  variableControl,
} from '../../app/utils/configurator-form';
import {
  findOption,
  findOptionGroup,
  findVariable,
  makeCabinetConfiguration,
  makeCascadedConfiguration,
  makeInitialConfiguration,
} from '../fixtures/configurator';

describe('variableControl', () => {
  it('reads the control off the seeded variables', () => {
    const workbench = makeInitialConfiguration();
    const cabinet = makeCabinetConfiguration();

    expect(variableControl(findVariable(workbench, 'width'))).toBe('number');
    expect(variableControl(findVariable(cabinet, 'pallet-code'))).toBe('text');
  });

  it('maps the two value types no seed uses', () => {
    expect(variableControl({ valueType: 'boolean' })).toBe('boolean');
    expect(variableControl({ valueType: 'date' })).toBe('date');
  });
});

describe('isReadOnly', () => {
  it('is true for the provider-owned variable in the cabinet', () => {
    const cabinet = makeCabinetConfiguration();
    expect(isReadOnly(findVariable(cabinet, 'front-area'))).toBe(true);
  });

  it('covers temporarilyLocked, which no seed produces', () => {
    expect(
      isReadOnly({ selectionSource: 'temporarilyLocked', readOnly: false }),
    ).toBe(true);
  });

  it('is true for a node the provider marks read-only, whatever its source', () => {
    expect(isReadOnly({ selectionSource: 'none', readOnly: true })).toBe(true);
    expect(isReadOnly({ selectionSource: 'manual', readOnly: true })).toBe(
      true,
    );
  });

  it('is false for every other source', () => {
    const workbench = makeInitialConfiguration();
    expect(isReadOnly(findVariable(workbench, 'width'))).toBe(false);
    expect(isReadOnly({ selectionSource: 'groupRule', readOnly: false })).toBe(
      false,
    );
    expect(isReadOnly({ selectionSource: 'manual', readOnly: false })).toBe(
      false,
    );
  });
});

describe('isSingleSelect', () => {
  it('follows maxSelections on the seeded groups', () => {
    const workbench = makeInitialConfiguration();
    expect(isSingleSelect(findOptionGroup(workbench, 'top'))).toBe(true);
    expect(isSingleSelect(findOptionGroup(workbench, 'accessories'))).toBe(
      false,
    );
  });

  it('treats a group without a ceiling as multi-choice', () => {
    expect(isSingleSelect({ maxSelections: undefined })).toBe(false);
    expect(isSingleSelect({ maxSelections: 2 })).toBe(false);
  });
});

describe('blockingMessage', () => {
  it('returns the reason an unavailable row carries', () => {
    const cascaded = makeCascadedConfiguration();
    expect(
      blockingMessage(findOption(cascaded, 'acc-castors').messages)?.text,
    ).toBe('Braked castors cannot be combined with electric legs.');
  });

  it('prefers an error over a warning, whatever the order', () => {
    const messages = [
      { severity: 'warning' as const, text: 'second' },
      { severity: 'error' as const, text: 'first' },
    ];
    expect(blockingMessage(messages)?.text).toBe('first');
  });

  it('is undefined when there is nothing to say', () => {
    expect(blockingMessage([])).toBeUndefined();
  });

  it('passes over an info message, which blocks nothing', () => {
    const info = { severity: 'info' as const, text: 'Good to know.' };
    const warning = { severity: 'warning' as const, text: 'Check this.' };
    expect(blockingMessage([info, warning])).toBe(warning);
    expect(blockingMessage([info])).toBeUndefined();
  });
});

describe('boundsParams', () => {
  it('reports the bounds the provider narrowed', () => {
    const cascaded = makeCascadedConfiguration();
    expect(boundsParams(findVariable(cascaded, 'width'))).toEqual({
      min: 800,
      max: 1600,
      unit: 'mm',
    });
  });

  it('is undefined unless both ends are set', () => {
    expect(
      boundsParams({ min: 1, max: undefined, unit: 'mm' }),
    ).toBeUndefined();
    expect(
      boundsParams({ min: undefined, max: 9, unit: 'mm' }),
    ).toBeUndefined();
  });

  it('falls back to an empty unit rather than printing undefined', () => {
    expect(boundsParams({ min: 0, max: 4, unit: undefined })).toEqual({
      min: 0,
      max: 4,
      unit: '',
    });
  });
});

describe('dateInputValue', () => {
  it('cuts a full ISO timestamp down to what a date input takes', () => {
    expect(dateInputValue('2026-09-17T00:00:00.000Z')).toBe('2026-09-17');
    expect(dateInputValue('2026-09-17')).toBe('2026-09-17');
  });

  it('is empty for anything that is not a date', () => {
    expect(dateInputValue(null)).toBe('');
    expect(dateInputValue(1200)).toBe('');
    expect(dateInputValue(true)).toBe('');
    expect(dateInputValue('PAL-80')).toBe('');
  });

  it('will not find a date inside another string, or half of one', () => {
    expect(dateInputValue('week of 2026-09-17')).toBe('');
    expect(dateInputValue('2026-09-1')).toBe('');
  });
});

describe('dateChangeValue', () => {
  it('passes a complete date through', () => {
    expect(dateChangeValue('2026-09-17')).toBe('2026-09-17');
  });

  it('reads a cleared or half-typed field as unset', () => {
    expect(dateChangeValue('')).toBeNull();
    expect(dateChangeValue('2026-09')).toBeNull();
    expect(dateChangeValue('2026-09-17T00:00:00.000Z')).toBeNull();
    expect(dateChangeValue('week of 2026-09-17')).toBeNull();
  });
});

describe('groupHintKey', () => {
  it('says a required group must be answered, whatever its shape', () => {
    expect(
      groupHintKey({ available: true, minSelections: 1, maxSelections: 1 }),
    ).toBe('configurator.required');
    expect(
      groupHintKey({
        available: true,
        minSelections: 2,
        maxSelections: undefined,
      }),
    ).toBe('configurator.required');
  });

  it('calls a skippable single choice optional and counts the rest', () => {
    expect(
      groupHintKey({ available: true, minSelections: 0, maxSelections: 1 }),
    ).toBe('configurator.optional');
    expect(groupHintKey({ available: true, maxSelections: undefined })).toBe(
      'configurator.choose_many',
    );
    expect(groupHintKey({ available: true, maxSelections: 3 })).toBe(
      'configurator.choose_many',
    );
  });

  it('says nothing of a requirement the provider made unavailable', () => {
    // The buyer cannot answer the group, so it asks nothing of them.
    expect(
      groupHintKey({ available: false, minSelections: 1, maxSelections: 1 }),
    ).toBeUndefined();
  });

  it('keeps the hint of an unavailable group that requires nothing', () => {
    expect(
      groupHintKey({ available: false, minSelections: 0, maxSelections: 1 }),
    ).toBe('configurator.optional');
  });
});

describe('optionPricePrefix', () => {
  it('signs a surcharge', () => {
    expect(optionPricePrefix(1400)).toBe('+');
  });

  it('leaves an amount that carries its own sign alone', () => {
    expect(optionPricePrefix(-250)).toBe('');
  });

  it('renders nothing for a row that adds nothing', () => {
    expect(optionPricePrefix(0)).toBeNull();
  });
});

describe('groupSummary', () => {
  it('says the group is empty when nothing is chosen', () => {
    const workbench = makeInitialConfiguration();

    // The made-to-order colour is what a fresh document leaves unanswered.
    expect(groupSummary(findOptionGroup(workbench, 'color'))).toEqual({
      kind: 'none',
    });
  });

  it('names the one row that is chosen', () => {
    const workbench = makeInitialConfiguration();

    expect(groupSummary(findOptionGroup(workbench, 'top'))).toEqual({
      kind: 'one',
      name: 'Laminate top',
    });
  });

  it("names the chosen row by the option's own name", () => {
    const workbench = makeInitialConfiguration();
    const group = findOptionGroup(workbench, 'top');
    const laminate = group.options.find((option) => option.selected)!;
    laminate.name = 'Provider name';
    laminate.product = null;

    expect(groupSummary(group)).toEqual({ kind: 'one', name: 'Provider name' });
  });

  it('counts the rows when there are several', () => {
    const workbench = makeInitialConfiguration();
    const group = findOptionGroup(workbench, 'accessories');
    group.options[0]!.selected = true;
    group.options[1]!.selected = true;

    expect(groupSummary(group)).toEqual({ kind: 'many', count: 2 });
  });

  it('counts a chosen row the rules turned unavailable', () => {
    const cascaded = makeCascadedConfiguration();
    const castors = findOption(cascaded, 'acc-castors');
    castors.selected = true;

    // It is still part of the configuration; a summary that left it out would
    // make the folded group look emptier than it is.
    expect(castors.available).toBe(false);
    expect(groupSummary(findOptionGroup(cascaded, 'accessories'))).toEqual({
      kind: 'many',
      count: 2,
    });
  });
});

describe('groupInfoSeverity', () => {
  const error = { severity: 'error', text: 'Out of production.' } as const;
  const warning = { severity: 'warning', text: 'Long lead time.' } as const;
  const info = { severity: 'info', text: 'Fitted at the factory.' } as const;

  it('has none without a message', () => {
    expect(groupInfoSeverity([])).toBeUndefined();
  });

  it('takes the one message it has', () => {
    expect(groupInfoSeverity([info])).toBe('info');
    expect(groupInfoSeverity([warning])).toBe('warning');
    expect(groupInfoSeverity([error])).toBe('error');
  });

  it('takes the most severe of several, wherever it stands', () => {
    expect(groupInfoSeverity([info, warning])).toBe('warning');
    expect(groupInfoSeverity([warning, info])).toBe('warning');
    expect(groupInfoSeverity([info, error, warning])).toBe('error');
    expect(groupInfoSeverity([info, info])).toBe('info');
  });
});

describe('usesChooser', () => {
  it('lists a group of one inline', () => {
    expect(OPTION_CHOOSER_ABOVE).toBe(1);
    expect(usesChooser(1)).toBe(false);
  });

  it('offers a group of two from a chooser', () => {
    expect(usesChooser(2)).toBe(true);
  });

  it('offers the twenty-six colours from a chooser', () => {
    const workbench = makeInitialConfiguration();

    expect(
      usesChooser(groupRowCount(findOptionGroup(workbench, 'color'))),
    ).toBe(true);
  });
});

describe('offersNoneRow', () => {
  it('leads an optional single choice with "nothing chosen"', () => {
    expect(offersNoneRow({ maxSelections: 1 })).toBe(true);
    expect(offersNoneRow({ maxSelections: 1, minSelections: 0 })).toBe(true);
  });

  it('gives a required single choice none', () => {
    expect(offersNoneRow({ maxSelections: 1, minSelections: 1 })).toBe(false);
  });

  it('gives a multi choice none, required or not', () => {
    expect(offersNoneRow({})).toBe(false);
    expect(offersNoneRow({ maxSelections: 2 })).toBe(false);
    expect(offersNoneRow({ maxSelections: 3, minSelections: 1 })).toBe(false);
  });
});

describe('groupRowCount', () => {
  it('counts "nothing chosen" as a row of an optional single choice', () => {
    const options = findOptionGroup(makeInitialConfiguration(), 'top').options;

    expect(groupRowCount({ options, maxSelections: 1 })).toBe(4);
    expect(groupRowCount({ options, maxSelections: 1, minSelections: 1 })).toBe(
      3,
    );
    expect(groupRowCount({ options })).toBe(3);
  });

  // One real option and "nothing chosen" is a choice of two, so it is made
  // from the chooser like any other.
  it('opens an optional single choice of one real option from the chooser', () => {
    const options = findOptionGroup(
      makeInitialConfiguration(),
      'top',
    ).options.slice(0, 1);

    expect(usesChooser(groupRowCount({ options, maxSelections: 1 }))).toBe(
      true,
    );
    expect(
      usesChooser(
        groupRowCount({ options, maxSelections: 1, minSelections: 1 }),
      ),
    ).toBe(false);
  });
});

describe('optionImage', () => {
  it("reads the first image of the option's product, as the product card does", () => {
    const workbench = makeInitialConfiguration();
    const option = findOption(workbench, 'top-wood');
    option.product!.productImages = [
      { fileName: 'beech-front.jpg', isPrimary: false, url: '' },
      { fileName: 'beech-side.jpg', isPrimary: false, url: '' },
    ];

    expect(optionImage(option)).toBe('beech-front.jpg');
  });

  it('has none for an option without a product, or a product without images', () => {
    const workbench = makeInitialConfiguration();
    const option = findOption(workbench, 'top-wood');

    expect(optionImage(option)).toBeUndefined();
    expect(optionImage({ ...option, product: null })).toBeUndefined();
  });

  it('has none for an image without a file name', () => {
    const workbench = makeInitialConfiguration();
    const option = findOption(workbench, 'top-wood');
    option.product!.productImages = [
      { fileName: '', isPrimary: false, url: '' },
    ];

    expect(optionImage(option)).toBeUndefined();
  });
});

describe('hasImageColumn', () => {
  it('is false when no option in the group has an image', () => {
    const workbench = makeInitialConfiguration();

    expect(hasImageColumn(findOptionGroup(workbench, 'top').options)).toBe(
      false,
    );
  });

  it('is true when one option in the group has an image', () => {
    const workbench = makeInitialConfiguration();
    const top = findOptionGroup(workbench, 'top');
    top.options[1]!.product!.productImages = [
      { fileName: 'beech.jpg', isPrimary: false, url: '' },
    ];

    expect(hasImageColumn(top.options)).toBe(true);
  });
});

describe('optionBlockReason', () => {
  it('says nothing about a row the buyer may use', () => {
    const workbench = makeInitialConfiguration();

    expect(
      optionBlockReason(findOption(workbench, 'top-wood'), false),
    ).toBeUndefined();
  });

  it('says nothing while the form is locked: a batch in flight is not a fact about the row', () => {
    const cabinet = makeCabinetConfiguration();

    expect(
      optionBlockReason(findOption(cabinet, 'mount-wall'), true),
    ).toBeUndefined();
  });

  it('names a read-only row as read only', () => {
    const workbench = makeInitialConfiguration();
    const option = findOption(workbench, 'top-wood');
    option.selectionSource = 'locked';

    expect(optionBlockReason(option, false)).toEqual({ kind: 'read_only' });
  });

  it('names a row the rules refuse as unavailable', () => {
    const workbench = makeInitialConfiguration();
    const option = findOption(workbench, 'top-wood');
    option.available = false;

    expect(optionBlockReason(option, false)).toEqual({ kind: 'unavailable' });
  });

  it("gives a blocked row's blocking message as its reason", () => {
    const cabinet = makeCabinetConfiguration();
    const option = findOption(cabinet, 'mount-wall');

    expect(optionBlockReason(option, false)).toEqual({
      kind: 'message',
      message: blockingMessage(option.messages),
    });
  });
});

describe('signedOptionPrice', () => {
  it('signs a surcharge', () => {
    expect(signedOptionPrice(1400, 'SEK', 'en-US')).toBe(
      `+${formatPrice(1400, 'SEK', 'en-US')}`,
    );
  });

  it('leaves a reduction to the sign the amount carries', () => {
    expect(signedOptionPrice(-250, 'SEK', 'en-US')).toBe(
      formatPrice(-250, 'SEK', 'en-US'),
    );
  });

  it('shows nothing for a row that adds nothing', () => {
    expect(signedOptionPrice(0, 'SEK', 'en-US')).toBe('');
  });

  it('falls back to the default currency when the price names none', () => {
    expect(signedOptionPrice(150, undefined, 'en-US')).toBe(
      `+${formatPrice(150, 'SEK', 'en-US')}`,
    );
  });
});

describe('matchesOptionQuery', () => {
  it('matches every row on an empty query', () => {
    const workbench = makeInitialConfiguration();

    expect(matchesOptionQuery(findOption(workbench, 'top-wood'), '')).toBe(
      true,
    );
    expect(matchesOptionQuery(findOption(workbench, 'top-wood'), '   ')).toBe(
      true,
    );
  });

  it('matches the name whatever the case', () => {
    const workbench = makeInitialConfiguration();
    const wood = findOption(workbench, 'top-wood');

    expect(matchesOptionQuery(wood, 'BEECH')).toBe(true);
    expect(matchesOptionQuery(wood, 'steel')).toBe(false);
  });

  it('matches the article number, which is the other line the row shows', () => {
    const workbench = makeInitialConfiguration();
    const wood = findOption(workbench, 'top-wood');

    expect(wood.name).not.toContain('TOP-WOOD');
    expect(matchesOptionQuery(wood, 'top-wood')).toBe(true);
  });

  it("searches the option's own name and article number, with no product", () => {
    const workbench = makeInitialConfiguration();
    const wood = { ...findOption(workbench, 'top-wood'), product: null };
    wood.name = 'Provider name';
    wood.articleNumber = 'ERP-4711';

    expect(matchesOptionQuery(wood, 'provider')).toBe(true);
    expect(matchesOptionQuery(wood, 'erp-47')).toBe(true);
    expect(matchesOptionQuery(wood, 'beech')).toBe(false);
  });
});

describe('messagesBesides', () => {
  it('returns the list untouched when none of it was promoted', () => {
    const cascaded = makeCascadedConfiguration();
    const messages = findOption(cascaded, 'acc-castors').messages;

    expect(messagesBesides(messages, undefined)).toBe(messages);
  });

  it('drops the one message that is already shown as the reason', () => {
    const cascaded = makeCascadedConfiguration();
    const messages = findOption(cascaded, 'acc-castors').messages;

    expect(messagesBesides(messages, messages[0])).toEqual([]);
  });

  it('keeps a second message the reason line does not carry', () => {
    const cascaded = makeCascadedConfiguration();
    const option = findOption(cascaded, 'acc-castors');
    const extra = { severity: 'warning' as const, text: 'Ships in 6 weeks.' };
    option.messages.push(extra);

    expect(messagesBesides(option.messages, option.messages[0])).toEqual([
      extra,
    ]);
  });
});

describe('boundsNarrowed', () => {
  it('sees the rule that capped the width', () => {
    const workbench = makeInitialConfiguration();
    const cascaded = makeCascadedConfiguration();

    expect(
      boundsNarrowed(
        findVariable(workbench, 'width'),
        findVariable(cascaded, 'width'),
      ),
    ).toBe(true);
  });

  it('is false while the range is the one it started with', () => {
    const workbench = makeInitialConfiguration();

    expect(
      boundsNarrowed(
        findVariable(workbench, 'width'),
        findVariable(workbench, 'width'),
      ),
    ).toBe(false);
  });

  it('sees a rule that lifted the floor', () => {
    expect(
      boundsNarrowed({ min: 800, max: 2000 }, { min: 1000, max: 2000 }),
    ).toBe(true);
  });

  it('is false for a range the rules widened', () => {
    expect(
      boundsNarrowed({ min: 800, max: 2000 }, { min: 600, max: 2400 }),
    ).toBe(false);
  });

  it('counts an end the rules gave a number for the first time', () => {
    // An absent end is an open one; capping it is as much a narrowing as
    // lowering a cap that was already there.
    expect(
      boundsNarrowed(
        { min: undefined, max: undefined },
        { min: 1000, max: 1600 },
      ),
    ).toBe(true);
  });

  it('counts a floor the rules gave a number for the first time', () => {
    // On its own, so the clause for the other end cannot answer for it.
    expect(
      boundsNarrowed({ min: undefined, max: 2000 }, { min: 1000, max: 2000 }),
    ).toBe(true);
  });

  it('is false when the rules opened an end that had a number', () => {
    expect(
      boundsNarrowed(
        { min: 800, max: 2000 },
        { min: undefined, max: undefined },
      ),
    ).toBe(false);
  });
});

describe('emptyStep', () => {
  // An empty field counts as 0, and a step from there is clamped to the range.
  it('steps up from zero by one when the variable has no step', () => {
    expect(emptyStep({}, 'up')).toBe(1);
  });

  it('steps down from zero by one when negatives are allowed', () => {
    expect(emptyStep({}, 'down')).toBe(-1);
  });

  it("steps by the variable's own step", () => {
    expect(emptyStep({ step: 0.5 }, 'up')).toBe(0.5);
    expect(emptyStep({ step: 0.5 }, 'down')).toBe(-0.5);
  });

  it('clamps a step up into a floor above it', () => {
    expect(emptyStep({ min: 5 }, 'up')).toBe(5);
    expect(emptyStep({ min: 800, step: 100 }, 'up')).toBe(800);
  });

  it('clamps a step down into a ceiling below it', () => {
    expect(emptyStep({ max: -5 }, 'down')).toBe(-5);
  });

  it('leaves a step inside the range alone', () => {
    expect(emptyStep({ min: -10, max: 10 }, 'up')).toBe(1);
    expect(emptyStep({ min: -10, max: 10 }, 'down')).toBe(-1);
    expect(emptyStep({ max: 0.5 }, 'down')).toBe(-1);
  });

  it('steps up from a floor of zero to the first step', () => {
    expect(emptyStep({ min: 0 }, 'up')).toBe(1);
    expect(emptyStep({ min: 0, max: 1000, step: 10 }, 'up')).toBe(10);
  });

  it('has no step down past a floor, as a filled field has none', () => {
    expect(emptyStep({ min: 0 }, 'down')).toBeNull();
    expect(emptyStep({ min: 5 }, 'down')).toBeNull();
  });

  it('has no step up past a ceiling', () => {
    expect(emptyStep({ max: 0 }, 'up')).toBeNull();
    expect(emptyStep({ max: 0.5 }, 'up')).toBeNull();
  });

  it('steps onto a bound exactly', () => {
    expect(emptyStep({ min: -1 }, 'down')).toBe(-1);
    expect(emptyStep({ max: 1 }, 'up')).toBe(1);
  });
});

describe('refusesVariable', () => {
  const refused = {
    type: 'variable',
    variableId: 'width',
    value: 0,
  } as const;

  it('names the variable the refused change was aimed at', () => {
    expect(refusesVariable(refused, 'width')).toBe(true);
  });

  it('names no other variable', () => {
    expect(refusesVariable(refused, 'depth')).toBe(false);
  });

  it('names nothing when an option or nothing was refused', () => {
    expect(
      refusesVariable(
        {
          type: 'option',
          optionId: 'width',
          instanceId: '1',
          selected: true,
          quantity: 1,
          lock: 'none',
        },
        'width',
      ),
    ).toBe(false);
    expect(refusesVariable(null, 'width')).toBe(false);
  });
});

describe('refusesOptionIn', () => {
  const group = {
    options: [
      { id: 'oak', instanceId: '1' },
      { id: 'ash', instanceId: '1' },
    ],
  };
  const pick = (optionId: string, instanceId = '1') =>
    ({
      type: 'option',
      optionId,
      instanceId,
      selected: true,
      quantity: 1,
      lock: 'none',
    }) as const;

  it('answers for a group holding the refused option', () => {
    expect(refusesOptionIn(pick('ash'), group)).toBe(true);
  });

  it('matches the instance too, not only the option id', () => {
    expect(refusesOptionIn(pick('ash', '2'), group)).toBe(false);
  });

  it("does not answer for another group's option", () => {
    expect(refusesOptionIn(pick('steel'), group)).toBe(false);
  });

  it('does not answer for a refused variable or for nothing', () => {
    expect(
      refusesOptionIn({ type: 'variable', variableId: 'oak', value: 1 }, group),
    ).toBe(false);
    expect(refusesOptionIn(null, group)).toBe(false);
  });
});
