import { describe, it, expect } from 'vitest';
import type {
  ConfigurationMessage,
  ConfigurationOption,
  ConfigurationOptionGroup,
  ConfigurationSection,
  ConfigurationVariable,
} from '../../shared/types/configurator';
import {
  activeIndex,
  flattenVisibleSections,
  hasNext,
  hasPrevious,
  resolveActiveId,
  sectionCrumbs,
  sectionRemaining,
  stepId,
  visibleChildren,
} from '../../app/utils/configurator-sections';
import { makeSectionTreeConfiguration } from '../fixtures/configurator';

// ---------------------------------------------------------------------------
// The rail's derivations.
//
// The tree cases run against the section-tree fixture, which is the initial
// document rearranged, so what is asserted here is the walk and not a shape
// this file invented. The counting cases build the smallest node that can carry
// the question, because a count wants a group that requires exactly what the
// test says it requires.
// ---------------------------------------------------------------------------

function section(
  id: string,
  parts: Partial<ConfigurationSection> = {},
): ConfigurationSection {
  return {
    id,
    name: id,
    visible: true,
    sections: [],
    variables: [],
    optionGroups: [],
    messages: [],
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
    available: true,
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
    required: true,
    available: true,
    selectionSource: 'none',
    valueSource: 'initial',
    messages: [],
    ...parts,
  };
}

const ERROR: ConfigurationMessage = {
  severity: 'error',
  text: 'The rules refused this combination.',
};

const WARNING: ConfigurationMessage = {
  severity: 'warning',
  text: 'Worth knowing, not worth stopping for.',
};

function optionRow(
  id: string,
  parts: Partial<ConfigurationOption> = {},
): ConfigurationOption {
  return {
    id,
    instanceId: '0',
    productId: '900000000000001',
    selected: false,
    available: true,
    selectionSource: 'none',
    quantity: 1,
    defaultQuantity: 1,
    unitPrice: { sellingPriceExVat: 0, currency: { code: 'SEK' } },
    discountPercent: 0,
    messages: [],
    product: { productId: 1 } as ConfigurationOption['product'],
    ...parts,
  };
}

const ids = (sections: ConfigurationSection[]): string[] =>
  flattenVisibleSections(sections).map((entry) => entry.section.id);

describe('flattenVisibleSections', () => {
  it('lists every visible section of the tree, in document order', () => {
    const config = makeSectionTreeConfiguration();

    expect(ids(config.sections)).toEqual([
      'frame',
      'finish',
      'edge-trim',
      'cable-mgmt',
      'extras',
    ]);
  });

  it('gives each entry one depth step per level below the top', () => {
    const config = makeSectionTreeConfiguration();

    expect(
      flattenVisibleSections(config.sections).map((entry) => entry.depth),
    ).toEqual([0, 1, 2, 0, 0]);
  });

  it('puts a child directly after its parent, before the parent’s next sibling', () => {
    const tree = [section('a', { sections: [section('a1')] }), section('b')];

    expect(ids(tree)).toEqual(['a', 'a1', 'b']);
  });

  it('orders siblings by the index, at every level', () => {
    const tree = [
      section('b', {
        sortIndex: 4,
        sections: [
          section('b2', { sortIndex: 7 }),
          section('b1', { sortIndex: 6 }),
        ],
      }),
      section('a', { sortIndex: 1 }),
    ];

    // The rail is the page order read downwards, so a provider that sends a
    // list out of index order must not give the buyer a different sequence
    // from the one the sections themselves are shown in.
    expect(ids(tree)).toEqual(['a', 'b', 'b1', 'b2']);
  });

  it('leaves out an invisible section', () => {
    expect(
      ids([section('shown'), section('hidden', { visible: false })]),
    ).toEqual(['shown']);
  });

  it('leaves out a visible child of an invisible section', () => {
    const config = makeSectionTreeConfiguration();

    expect(ids(config.sections)).not.toContain('pallet-store');
  });

  it('takes the whole subtree of an invisible section, not only its own level', () => {
    const tree = [
      section('hidden', {
        visible: false,
        sections: [section('child', { sections: [section('grandchild')] })],
      }),
    ];

    expect(ids(tree)).toEqual([]);
  });

  it('is empty for a document with no visible section', () => {
    expect(flattenVisibleSections([section('a', { visible: false })])).toEqual(
      [],
    );
  });

  it('is empty for a document with no sections at all', () => {
    expect(flattenVisibleSections([])).toEqual([]);
  });

  it('carries each section’s own count on its entry', () => {
    const config = makeSectionTreeConfiguration();
    const entries = flattenVisibleSections(config.sections);

    // `color` is the one group nothing is selected in, and it sits in `finish`.
    expect(
      Object.fromEntries(
        entries.map((entry) => [entry.section.id, entry.remaining]),
      ),
    ).toEqual({
      frame: 0,
      finish: 1,
      'edge-trim': 0,
      'cable-mgmt': 0,
      extras: 0,
    });
  });
});

describe('sectionRemaining', () => {
  it('counts a group that is short of its required selections', () => {
    expect(
      sectionRemaining(
        section('a', { optionGroups: [group('g', { minSelections: 1 })] }),
      ),
    ).toBe(1);
  });

  it('does not count a group that requires nothing', () => {
    expect(sectionRemaining(section('a', { optionGroups: [group('g')] }))).toBe(
      0,
    );
  });

  it('counts a required variable with no value', () => {
    expect(sectionRemaining(section('a', { variables: [variable('v')] }))).toBe(
      1,
    );
  });

  it('does not count a variable that is not required', () => {
    expect(
      sectionRemaining(
        section('a', { variables: [variable('v', { required: false })] }),
      ),
    ).toBe(0);
  });

  it('counts groups and variables together', () => {
    expect(
      sectionRemaining(
        section('a', {
          optionGroups: [group('g', { minSelections: 1 })],
          variables: [variable('v')],
        }),
      ),
    ).toBe(2);
  });

  it('counts a group nested inside a group, which renders on the same page', () => {
    expect(
      sectionRemaining(
        section('a', {
          optionGroups: [
            group('outer', {
              minSelections: 1,
              optionGroups: [group('inner', { minSelections: 1 })],
            }),
          ],
        }),
      ),
    ).toBe(2);
  });

  it('counts a group nested two levels inside a group', () => {
    expect(
      sectionRemaining(
        section('a', {
          optionGroups: [
            group('outer', {
              optionGroups: [
                group('middle', {
                  optionGroups: [group('inner', { minSelections: 1 })],
                }),
              ],
            }),
          ],
        }),
      ),
    ).toBe(1);
  });

  it('does not add up a child section’s count', () => {
    expect(
      sectionRemaining(
        section('a', {
          sections: [
            section('child', {
              optionGroups: [group('g', { minSelections: 1 })],
            }),
          ],
        }),
      ),
    ).toBe(0);
  });

  it('counts a group the provider put an error on, selection or not', () => {
    // Filled in and still wrong: the rules refused what was chosen. The banner
    // names it, so the rail has to point at the section that holds it.
    expect(
      sectionRemaining(
        section('a', {
          optionGroups: [
            group('g', {
              minSelections: 1,
              messages: [ERROR],
              options: [optionRow('o', { selected: true })],
            }),
          ],
        }),
      ),
    ).toBe(1);
  });

  it('counts a group that is both unmet and in error only once', () => {
    expect(
      sectionRemaining(
        section('a', {
          optionGroups: [group('g', { minSelections: 1, messages: [ERROR] })],
        }),
      ),
    ).toBe(1);
  });

  it('counts an error on a single option row', () => {
    expect(
      sectionRemaining(
        section('a', {
          optionGroups: [
            group('g', { options: [optionRow('o', { messages: [ERROR] })] }),
          ],
        }),
      ),
    ).toBe(1);
  });

  it('counts an error on the section itself', () => {
    expect(sectionRemaining(section('a', { messages: [ERROR] }))).toBe(1);
  });

  it('counts an error on a variable that has a value', () => {
    expect(
      sectionRemaining(
        section('a', {
          variables: [variable('v', { value: 'set', messages: [ERROR] })],
        }),
      ),
    ).toBe(1);
  });

  it('counts an error inside a nested group', () => {
    expect(
      sectionRemaining(
        section('a', {
          optionGroups: [
            group('outer', {
              optionGroups: [group('inner', { messages: [ERROR] })],
            }),
          ],
        }),
      ),
    ).toBe(1);
  });

  it('does not count a warning, which stops nothing', () => {
    expect(
      sectionRemaining(
        section('a', {
          messages: [WARNING],
          optionGroups: [
            group('g', {
              messages: [WARNING],
              options: [optionRow('o', { messages: [WARNING] })],
            }),
          ],
          variables: [variable('v', { value: 'set', messages: [WARNING] })],
        }),
      ),
    ).toBe(0);
  });

  it('is zero for a section with nothing in it', () => {
    expect(sectionRemaining(section('a'))).toBe(0);
  });
});

describe('resolveActiveId', () => {
  const rail = (...ids: string[]) =>
    flattenVisibleSections(ids.map((id) => section(id)));

  it('keeps the section the buyer is on when the new document still has it', () => {
    expect(resolveActiveId(rail('a', 'b'), 'b', rail('a', 'b'))).toBe('b');
  });

  it('falls back to the entry before the one that vanished', () => {
    // The buyer stood on the third of four; a rule hid it, and the second is
    // next to where they were looking. The first would cost them the walk down.
    const before = rail('a', 'b', 'c', 'd');

    expect(resolveActiveId(rail('a', 'b', 'd'), 'c', before)).toBe('b');
  });

  it('keeps stepping back past an entry that also went away', () => {
    const before = rail('a', 'b', 'c', 'd');

    expect(resolveActiveId(rail('a', 'd'), 'c', before)).toBe('a');
  });

  it('steps back to the very first entry the rail had, not to the new top', () => {
    // A rule revealed `x` above everything, and the section the buyer stood on
    // went away. The entry before it is `a`, which is no longer the first.
    const before = rail('a', 'b', 'c');

    expect(resolveActiveId(rail('x', 'a'), 'b', before)).toBe('a');
  });

  it('skips two vanished entries in a row and lands on the third back', () => {
    // `d` went, and so did `c` and `b` above it. `a` survives but is no longer
    // the first entry, so only the walk backwards can produce it — the fallback
    // would answer `x`.
    const before = rail('a', 'b', 'c', 'd');

    expect(resolveActiveId(rail('x', 'a'), 'd', before)).toBe('a');
  });

  it('lands on the new first entry when the vanished one was first', () => {
    const before = rail('a', 'b');

    expect(resolveActiveId(rail('b'), 'a', before)).toBe('b');
  });

  it('falls back to the first entry when the rail it stood in is unknown', () => {
    expect(resolveActiveId(rail('a', 'b'), 'gone', [])).toBe('a');
  });

  it('falls back to the first entry when nothing is marked yet', () => {
    expect(resolveActiveId(rail('a', 'b'), null, [])).toBe('a');
  });

  it('is null when there is nothing to stand on', () => {
    expect(resolveActiveId([], 'a', rail('a'))).toBeNull();
  });

  it('does not keep a section the new document hid', () => {
    const hidden = flattenVisibleSections([
      section('a'),
      section('b', { visible: false }),
    ]);

    expect(resolveActiveId(hidden, 'b', rail('a', 'b'))).toBe('a');
  });
});

describe('activeIndex', () => {
  const entries = flattenVisibleSections([
    section('a', { sections: [section('a1')] }),
    section('b'),
  ]);

  it('finds the marked entry in the flattened order, not the document’s top level', () => {
    expect(activeIndex(entries, 'b')).toBe(2);
  });

  it('is -1 when the id is not in the rail', () => {
    expect(activeIndex(entries, 'gone')).toBe(-1);
  });

  it('is -1 when nothing is marked', () => {
    expect(activeIndex(entries, null)).toBe(-1);
  });
});

describe('hasPrevious and hasNext', () => {
  it('has no previous on the first entry', () => {
    expect(hasPrevious(0)).toBe(false);
  });

  it('has a previous on the second entry', () => {
    expect(hasPrevious(1)).toBe(true);
  });

  it('has a next while entries remain', () => {
    expect(hasNext(0, 3)).toBe(true);
    expect(hasNext(1, 3)).toBe(true);
  });

  it('has no next on the last entry', () => {
    expect(hasNext(2, 3)).toBe(false);
  });

  it('has neither on a one-entry rail', () => {
    expect(hasPrevious(0)).toBe(false);
    expect(hasNext(0, 1)).toBe(false);
  });

  it('has no next when nothing is marked', () => {
    expect(hasNext(-1, 3)).toBe(false);
  });

  it('has no previous when nothing is marked', () => {
    expect(hasPrevious(-1)).toBe(false);
  });
});

describe('stepId', () => {
  const entries = flattenVisibleSections([
    section('a'),
    section('b'),
    section('c'),
  ]);

  it('steps forward', () => {
    expect(stepId(entries, 0, 1)).toBe('b');
  });

  it('steps back', () => {
    expect(stepId(entries, 2, -1)).toBe('b');
  });

  it('clamps at the end rather than wrapping to the start', () => {
    expect(stepId(entries, 2, 1)).toBe('c');
  });

  it('clamps at the start rather than wrapping to the end', () => {
    expect(stepId(entries, 0, -1)).toBe('a');
  });

  it('is null when there is no rail to step in', () => {
    expect(stepId([], 0, 1)).toBeNull();
  });
});

describe('flattenVisibleSections numbers', () => {
  const numbers = (sections: ConfigurationSection[]): string[] =>
    flattenVisibleSections(sections).map((entry) => entry.number);

  it('numbers the tree by level, a child under its parent\u2019s number', () => {
    const config = makeSectionTreeConfiguration();

    expect(numbers(config.sections)).toEqual(['1', '1.1', '1.1.1', '2', '3']);
  });

  it('restarts the count inside every parent', () => {
    const tree = [
      section('a', { sections: [section('a1'), section('a2')] }),
      section('b', { sections: [section('b1')] }),
    ];

    expect(numbers(tree)).toEqual(['1', '1.1', '1.2', '2', '2.1']);
  });

  it('numbers by the index the sections are shown in, not the order given', () => {
    const tree = [
      section('b', { sortIndex: 4 }),
      section('a', { sortIndex: 1 }),
    ];

    expect(
      flattenVisibleSections(tree).map((entry) => entry.section.id),
    ).toEqual(['a', 'b']);
    expect(numbers(tree)).toEqual(['1', '2']);
  });

  it('leaves no hole where a hidden section sits between two visible ones', () => {
    const tree = [
      section('first'),
      section('hidden', { visible: false }),
      section('third'),
    ];

    // A buyer reading 1, 3 would be looking for a page the rail does not list.
    expect(numbers(tree)).toEqual(['1', '2']);
  });

  it('leaves no hole among children either', () => {
    const tree = [
      section('a', {
        sections: [
          section('a1'),
          section('hidden', { visible: false }),
          section('a2'),
        ],
      }),
    ];

    expect(numbers(tree)).toEqual(['1', '1.1', '1.2']);
  });

  it('keeps numbering past the depth the seeds reach', () => {
    const tree = [
      section('a', {
        sections: [
          section('a1', {
            sections: [section('a11', { sections: [section('a111')] })],
          }),
        ],
      }),
    ];

    expect(numbers(tree)).toEqual(['1', '1.1', '1.1.1', '1.1.1.1']);
  });
});

describe('sectionCrumbs', () => {
  const crumbIds = (
    sections: ConfigurationSection[],
    activeId: string | null,
  ): string[] =>
    sectionCrumbs(flattenVisibleSections(sections), activeId).map(
      (entry) => entry.section.id,
    );

  it('is the section alone at the top level, which is what hides the trail', () => {
    const config = makeSectionTreeConfiguration();

    expect(crumbIds(config.sections, 'frame')).toEqual(['frame']);
  });

  it('names every ancestor of a grandchild, outermost first, itself last', () => {
    const config = makeSectionTreeConfiguration();

    expect(crumbIds(config.sections, 'edge-trim')).toEqual([
      'frame',
      'finish',
      'edge-trim',
    ]);
  });

  it('takes the ancestor above the entry, not the first section at that depth', () => {
    const tree = [
      section('a', { sections: [section('a1')] }),
      section('b', { sections: [section('b1')] }),
    ];

    expect(crumbIds(tree, 'b1')).toEqual(['b', 'b1']);
  });

  it('looks backwards from the entry, never forwards', () => {
    const tree = [
      section('a', { sections: [section('a1')] }),
      section('b', { sections: [section('b1')] }),
    ];

    // `b` sits directly after `a1` at the depth `a1`'s parent has. A walk that
    // read forwards would name the next top-level section as the ancestor.
    expect(crumbIds(tree, 'a1')).toEqual(['a', 'a1']);
  });

  it('skips the deeper entries between a section and its parent', () => {
    const tree = [
      section('a', {
        sections: [
          section('a1', { sections: [section('a11')] }),
          section('a2'),
        ],
      }),
    ];

    // Between `a2` and `a` lie a sibling and that sibling's child. Only the
    // entry one level up is an ancestor; the two below it are cousins.
    expect(crumbIds(tree, 'a2')).toEqual(['a', 'a2']);
  });

  it('is empty for an id the rail does not list', () => {
    const config = makeSectionTreeConfiguration();

    expect(crumbIds(config.sections, 'pallet-store')).toEqual([]);
    expect(crumbIds(config.sections, null)).toEqual([]);
  });

  it('is empty for an empty rail, which is the loading face', () => {
    expect(sectionCrumbs([], 'frame')).toEqual([]);
  });
});

describe('visibleChildren', () => {
  it('is empty for a section with no children', () => {
    expect(visibleChildren(section('a'))).toEqual([]);
  });

  it('gives the children in index order, not the order sent', () => {
    const parent = section('a', {
      sections: [
        section('a2', { sortIndex: 7 }),
        section('a1', { sortIndex: 3 }),
      ],
    });

    expect(visibleChildren(parent).map((child) => child.id)).toEqual([
      'a1',
      'a2',
    ]);
  });

  it('leaves out a hidden child, which the rail leaves out too', () => {
    const parent = section('a', {
      sections: [section('shown'), section('hidden', { visible: false })],
    });

    // A menu built from these would otherwise offer a way into a page the rail
    // does not list.
    expect(visibleChildren(parent).map((child) => child.id)).toEqual(['shown']);
  });

  it('never descends: a grandchild is the child\u2019s business', () => {
    const parent = section('a', {
      sections: [section('a1', { sections: [section('a11')] })],
    });

    expect(visibleChildren(parent).map((child) => child.id)).toEqual(['a1']);
  });
});
