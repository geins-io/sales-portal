import { describe, it, expect } from 'vitest';
import {
  blockingMessage,
  boundsNarrowed,
  boundsParams,
  dateChangeValue,
  dateInputValue,
  groupHintKey,
  groupSummary,
  isReadOnly,
  isSingleSelect,
  matchesOptionQuery,
  messagesBesides,
  OPTION_PREVIEW_LIMIT,
  optionPricePrefix,
  previewOptions,
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
    expect(groupHintKey({ minSelections: 1, maxSelections: 1 })).toBe(
      'configurator.required',
    );
    expect(groupHintKey({ minSelections: 2, maxSelections: undefined })).toBe(
      'configurator.required',
    );
  });

  it('calls a skippable single choice optional and counts the rest', () => {
    expect(groupHintKey({ minSelections: 0, maxSelections: 1 })).toBe(
      'configurator.optional',
    );
    expect(groupHintKey({ maxSelections: undefined })).toBe(
      'configurator.choose_many',
    );
    expect(groupHintKey({ maxSelections: 3 })).toBe('configurator.choose_many');
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

describe('previewOptions', () => {
  it('leaves a group at the limit in the order the provider sent it', () => {
    const options = Array.from({ length: OPTION_PREVIEW_LIMIT }, (_, i) => ({
      id: i,
      selected: i === OPTION_PREVIEW_LIMIT - 1,
    }));

    // A group that fits is shown as it arrived: pulling the chosen row to the
    // front would reorder a list nobody asked to have reordered.
    expect(previewOptions(options)).toEqual(options);
  });

  it('cuts one row past the limit down to it', () => {
    const options = Array.from(
      { length: OPTION_PREVIEW_LIMIT + 1 },
      (_, i) => ({
        id: i,
        selected: false,
      }),
    );

    expect(previewOptions(options)).toEqual(
      options.slice(0, OPTION_PREVIEW_LIMIT),
    );
  });

  it('shows a chosen row once, not twice', () => {
    const options = Array.from(
      { length: OPTION_PREVIEW_LIMIT + 1 },
      (_, i) => ({
        id: i,
        selected: i === 0,
      }),
    );

    expect(previewOptions(options)).toEqual(
      options.slice(0, OPTION_PREVIEW_LIMIT),
    );
  });

  it('keeps a chosen row on screen wherever it sits in the list', () => {
    const workbench = makeInitialConfiguration();
    const colours = findOptionGroup(workbench, 'color');
    const last = colours.options[colours.options.length - 1]!;
    last.selected = true;

    const preview = previewOptions(colours.options);

    expect(preview).toHaveLength(OPTION_PREVIEW_LIMIT);
    expect(preview[0]).toBe(last);
  });

  it("keeps the provider's order among the rows that are not chosen", () => {
    const workbench = makeInitialConfiguration();
    const colours = findOptionGroup(workbench, 'color');

    expect(previewOptions(colours.options)).toEqual(
      colours.options.slice(0, OPTION_PREVIEW_LIMIT),
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
