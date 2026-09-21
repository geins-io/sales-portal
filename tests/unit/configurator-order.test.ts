import { describe, expect, it } from 'vitest';
import type {
  ConfigurationOptionGroup,
  ConfigurationSection,
  ConfigurationVariable,
} from '#shared/types/configurator';
import {
  orderedSections,
  sectionBlocks,
  sectionMembers,
} from '~/utils/configurator-order';

// ---------------------------------------------------------------------------
// Minimal nodes rather than a seeded document: what is measured here is the
// comparator, and a seed carries an order someone chose for the browser. The
// all-null and partially numbered documents below cannot be seeded at all —
// every seed declares the field.
// ---------------------------------------------------------------------------

function variable(
  id: string,
  sortIndex?: number | null,
): ConfigurationVariable {
  return {
    id,
    name: id,
    sortIndex,
    description: '',
    valueType: 'number',
    value: 0,
    defaultValue: 0,
    required: false,
    available: true,
    selectionSource: 'none',
    valueSource: 'initial',
    messages: [],
  };
}

function group(
  id: string,
  sortIndex?: number | null,
): ConfigurationOptionGroup {
  return {
    id,
    code: id.toUpperCase(),
    name: id,
    sortIndex,
    available: true,
    quantityEditable: false,
    optionGroups: [],
    options: [],
    messages: [],
  };
}

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

/** `g:legs`, `v:width` — short enough to read a whole order as one array. */
function names(
  members: ReturnType<typeof sectionMembers>,
): `${'g' | 'v'}:${string}`[] {
  return members.map((member) =>
    member.kind === 'group'
      ? (`g:${member.group.id}` as const)
      : (`v:${member.variable.id}` as const),
  );
}

describe('sectionMembers', () => {
  it('merges the two lists into the order the indices give', () => {
    const frame = section('frame', {
      optionGroups: [group('legs', 2), group('industrial', 5)],
      variables: [variable('width', 3), variable('depth', 4)],
    });

    // The shape the demo install shows: a group, the fields the merchant put
    // under it, then the next group. Neither list alone can express it.
    const members = sectionMembers(frame);
    expect(names(members)).toEqual([
      'g:legs',
      'v:width',
      'v:depth',
      'g:industrial',
    ]);
    // The tag a caller reads to know which node it was handed.
    expect(members.map((member) => member.kind)).toEqual([
      'group',
      'variable',
      'variable',
      'group',
    ]);
  });

  it('falls back to groups then variables when nothing carries an index', () => {
    const frame = section('frame', {
      optionGroups: [group('legs'), group('industrial')],
      variables: [variable('width'), variable('depth')],
    });

    // A provider that sends no index must keep the page it has today.
    expect(names(sectionMembers(frame))).toEqual([
      'g:legs',
      'g:industrial',
      'v:width',
      'v:depth',
    ]);
  });

  it('puts an unnumbered member last, in that same fallback order', () => {
    const frame = section('frame', {
      optionGroups: [group('legs'), group('industrial', 1)],
      variables: [variable('width', 2), variable('depth', null)],
    });

    expect(names(sectionMembers(frame))).toEqual([
      'g:industrial',
      'v:width',
      'g:legs',
      'v:depth',
    ]);
  });

  it('keeps the merge order where two members share an index', () => {
    const frame = section('frame', {
      optionGroups: [group('legs', 1)],
      variables: [variable('width', 1), variable('depth', 1)],
    });

    // A stable sort, so a provider that numbers two members the same gets the
    // fallback order between them rather than whatever the engine felt like.
    expect(names(sectionMembers(frame))).toEqual([
      'g:legs',
      'v:width',
      'v:depth',
    ]);
  });

  it('leaves the section it was given untouched', () => {
    const frame = section('frame', {
      optionGroups: [group('legs', 4)],
      variables: [variable('width', 1)],
    });

    sectionMembers(frame);

    // Every change batch returns a whole document the client swaps in; a walk
    // that sorted in place would reorder the document the panel then reads.
    expect(frame.optionGroups.map((each) => each.id)).toEqual(['legs']);
    expect(frame.variables.map((each) => each.id)).toEqual(['width']);
  });

  it('does not reach into the child sections', () => {
    const frame = section('frame', {
      optionGroups: [group('legs', 2)],
      sections: [section('finish', { optionGroups: [group('top', 1)] })],
    });

    // A child is a page of its own in the rail, so its groups are never part
    // of the parent's page however Monitor numbered them.
    expect(names(sectionMembers(frame))).toEqual(['g:legs']);
  });
});

describe('sectionBlocks', () => {
  it('folds a run of variables into one block and lets a group break it', () => {
    const frame = section('frame', {
      optionGroups: [group('legs', 1), group('industrial', 4)],
      variables: [variable('width', 2), variable('depth', 3)],
    });

    expect(
      sectionBlocks(frame).map((block) =>
        block.kind === 'group'
          ? `g:${block.group.id}`
          : `v:${block.variables.map((each) => each.id).join(',')}`,
      ),
    ).toEqual(['g:legs', 'v:width,depth', 'g:industrial']);
  });

  it('gives a lone variable between two groups a block of its own', () => {
    const frame = section('frame', {
      optionGroups: [group('legs', 1), group('industrial', 3)],
      variables: [variable('width', 2)],
    });

    const blocks = sectionBlocks(frame);

    expect(blocks).toHaveLength(3);
    expect(blocks[1]).toEqual({
      kind: 'variables',
      variables: [expect.any(Object)],
    });
  });

  it('opens with a grid where the first member is a field', () => {
    const logistics = section('logistics', {
      variables: [variable('pallet-code', 1), variable('weight', 2)],
    });

    // A section can hold no list at all, and the run then starts against an
    // empty result rather than after a group.
    expect(sectionBlocks(logistics)).toEqual([
      {
        kind: 'variables',
        variables: [expect.any(Object), expect.any(Object)],
      },
    ]);
  });

  it('is empty for a section that holds neither', () => {
    expect(sectionBlocks(section('empty'))).toEqual([]);
  });
});

describe('orderedSections', () => {
  it('orders siblings by the index and leaves an unnumbered list alone', () => {
    const numbered = [section('b'), section('a')];
    numbered[0]!.sortIndex = 9;
    numbered[1]!.sortIndex = 2;

    expect(orderedSections(numbered).map((each) => each.id)).toEqual([
      'a',
      'b',
    ]);
    expect(
      orderedSections([section('b'), section('a')]).map((each) => each.id),
    ).toEqual(['b', 'a']);
  });

  it('leaves the list it was given untouched', () => {
    const sections = [section('b'), section('a')];
    sections[0]!.sortIndex = 9;
    sections[1]!.sortIndex = 2;

    orderedSections(sections);

    expect(sections.map((each) => each.id)).toEqual(['b', 'a']);
  });
});
