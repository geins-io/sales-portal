import type {
  ConfigurationOptionGroup,
  ConfigurationSection,
  ConfigurationVariable,
} from '#shared/types/configurator';

// ---------------------------------------------------------------------------
// The order a section's content is shown in, in one place.
//
// The document gives a section three sibling lists — variables, option groups
// and child sections — and `sortIndex` orders their members against each
// other, so the page shows the arrangement the merchant built. Five callers
// share this: the section page, the specification rows, the two walks behind
// the banner, and the rail.
//
// The provider's index is the only order there is. Where it is absent the
// merge order below is what remains, and that is deliberately the order the
// portal shipped before the field existed.
// ---------------------------------------------------------------------------

export type SectionMember =
  | { kind: 'group'; group: ConfigurationOptionGroup }
  | { kind: 'variable'; variable: ConfigurationVariable };

export type SectionBlock =
  | { kind: 'group'; group: ConfigurationOptionGroup }
  | { kind: 'variables'; variables: ConfigurationVariable[] };

type Index = number | null | undefined;

/** Null last, and spelled out rather than left to `Infinity - Infinity`. */
function compareIndex(a: Index, b: Index): number {
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  return a - b;
}

/**
 * A copy in index order, the input untouched.
 *
 * `Array.prototype.sort` is stable, so members the provider numbered the same
 * — and every member of a document that carries no index at all — keep the
 * order they were given in. That is why the fallback needs no branch of its
 * own: the caller merges in the order it wants for an unnumbered document, and
 * a sort that finds nothing to order returns it.
 *
 * The index is read through a function rather than off the node, because a
 * `SectionMember` wraps the node that carries it — and an optional property
 * makes a wrapper without one structurally acceptable, so a version that read
 * `node.sortIndex` compiled and sorted nothing.
 */
function byIndex<T>(nodes: T[], indexOf: (node: T) => Index): T[] {
  return [...nodes].sort((a, b) => compareIndex(indexOf(a), indexOf(b)));
}

/**
 * A section's own content in one ordered list: its option groups and its
 * variables, never its child sections.
 *
 * Groups before variables in the merge, so a document with no index renders
 * the design reference's order — the only one such a document can justify.
 */
export function sectionMembers(section: ConfigurationSection): SectionMember[] {
  const members: SectionMember[] = [
    ...section.optionGroups.map(
      (group): SectionMember => ({ kind: 'group', group }),
    ),
    ...section.variables.map(
      (variable): SectionMember => ({ kind: 'variable', variable }),
    ),
  ];

  return byIndex(members, (member) =>
    member.kind === 'group'
      ? member.group.sortIndex
      : member.variable.sortIndex,
  );
}

/**
 * The same order as blocks to render: a group, or a run of variables that sit
 * next to each other.
 *
 * A run shares one two-column grid, so a section whose fields arrive together
 * looks as it did when they were gathered under a heading, and a lone field
 * between two groups gets the box it would have had as the odd one out. Built
 * here rather than in the template because Stryker instruments a file before
 * the Vue compiler runs: a rule written in a template is one nothing proves.
 */
export function sectionBlocks(section: ConfigurationSection): SectionBlock[] {
  const blocks: SectionBlock[] = [];

  for (const member of sectionMembers(section)) {
    if (member.kind === 'group') {
      blocks.push({ kind: 'group', group: member.group });
      continue;
    }
    const last = blocks.at(-1);
    if (last?.kind === 'variables') last.variables.push(member.variable);
    else blocks.push({ kind: 'variables', variables: [member.variable] });
  }

  return blocks;
}

/** Sibling sections in index order — identity where the provider sent them so. */
export function orderedSections(
  sections: ConfigurationSection[],
): ConfigurationSection[] {
  return byIndex(sections, (section) => section.sortIndex);
}
