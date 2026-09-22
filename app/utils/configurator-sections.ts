import type {
  ConfigurationMessage,
  ConfigurationSection,
} from '#shared/types/configurator';
import {
  isGroupUnmet,
  isVariableUnmet,
} from '#shared/utils/configurator-requirement';
import { orderedSections } from '~/utils/configurator-order';

// ---------------------------------------------------------------------------
// The rail, and where in it the buyer stands.
//
// The document's sections are a tree; the rail is that tree flattened, one
// entry per visible section at any depth. The prototype cannot be copied here:
// its rail is a hardcoded flat list of three that names its members by id and
// has no notion of a section inside a section.
//
// In a `.ts` rather than in the page for the reason the rest of the
// configurator keeps its rules out of templates: Stryker instruments a file
// before the Vue compiler runs, so a condition written in a template is one
// nothing proves.
// ---------------------------------------------------------------------------

export interface SectionEntry {
  section: ConfigurationSection;
  /** 0 for a top-level section, one step per level below it. */
  depth: number;
  /** Where it sits in the tree, spelled out: `1`, `2`, `2.1`, `2.1.1`. */
  number: string;
  /** Its own outstanding choices. A child's are the child's. */
  remaining: number;
}

/** A node the provider has already objected to, whatever else is true of it. */
function hasError(node: { messages: ConfigurationMessage[] }): boolean {
  return node.messages.some((message) => message.severity === 'error');
}

/**
 * How many things in this section want the buyer's attention, its children's
 * excluded.
 *
 * Two kinds count, and a node that is both counts once. A requirement the buyer
 * has not answered — `isGroupUnmet`, `isVariableUnmet`, the same two functions
 * the panel's banner uses, so "kvar" means one thing on a page that says it in
 * two places. And a node the provider put an `error` on, which the banner also
 * lists: a group that holds a selection the rules have since refused is filled
 * in and still wrong, and a rail that stayed silent about it would point the
 * buyer at nothing while the banner told them something was broken. The walk is
 * `everyBlockingMessage`'s, bounded to one section.
 *
 * The section itself can carry an error, and so can a single option row; both
 * are a thing to go and look at, so both count.
 *
 * One kind of error no badge can ever carry: the ones the provider puts on the
 * document root (`configuration.messages`). The banner lists them and no
 * section owns them, so the rail has nowhere to point. A reader who finds the
 * banner talking while every badge is silent is looking at that, not at a bug.
 *
 * Groups nested inside groups are this section's content — they render on its
 * page — so the walk descends into them. It never descends into
 * `section.sections`: a child section is an entry of its own, and the buyer can
 * see its badge. Rolling children up mattered when branches could be collapsed.
 */
export function sectionRemaining(section: ConfigurationSection): number {
  const countGroups = (groups: ConfigurationSection['optionGroups']): number =>
    groups.reduce(
      (total, group) =>
        total +
        (isGroupUnmet(group) || hasError(group) ? 1 : 0) +
        group.options.filter(hasError).length +
        countGroups(group.optionGroups),
      0,
    );

  return (
    (hasError(section) ? 1 : 0) +
    countGroups(section.optionGroups) +
    section.variables.filter(
      (variable) => isVariableUnmet(variable) || hasError(variable),
    ).length
  );
}

/**
 * Every visible section, in `sortIndex` order, depth-first, with its depth and
 * the number the rail prints in front of it.
 *
 * An invisible section takes its whole subtree with it. The page's other walks
 * already do that (`collectBlockingMessages`, the banner's), so a rail entry
 * under a hidden parent would be a section whose error messages the panel drops
 * and whose requirements the banner refuses to name — two parts of one page
 * disagreeing about what is on screen.
 *
 * The counter steps for a section that is shown, not for one the document
 * holds: a hidden `Logistics` between two visible sections would otherwise
 * leave a hole in the numbering, and a buyer counting `1, 2, 4` is looking for
 * a page nothing lists.
 */
export function flattenVisibleSections(
  sections: ConfigurationSection[],
): SectionEntry[] {
  const entries: SectionEntry[] = [];

  const walk = (
    level: ConfigurationSection[],
    depth: number,
    prefix: string,
  ): void => {
    let shown = 0;
    for (const section of orderedSections(level)) {
      if (!section.visible) continue;
      shown += 1;
      const number = `${prefix}${shown}`;
      entries.push({
        section,
        depth,
        number,
        remaining: sectionRemaining(section),
      });
      walk(section.sections, depth + 1, `${number}.`);
    }
  };

  walk(sections, 0, '');

  return entries;
}

/**
 * The trail to an entry: its ancestors outermost first, the entry itself last.
 *
 * Read off the flattened list rather than off the tree, because the list is
 * pre-order — every ancestor of an entry sits before it, and the nearest entry
 * above it at each shallower depth is the one. An id the list does not hold
 * answers empty, which is the loading face and the rail with nothing in it.
 *
 * Not a field on `SectionEntry`: only the active entry's trail is ever read,
 * and carrying one on every entry would rebuild the whole tree's on every
 * document.
 */
export function sectionCrumbs(
  entries: SectionEntry[],
  activeId: string | null,
): SectionEntry[] {
  const index = entries.findIndex((entry) => entry.section.id === activeId);
  const active = entries[index];
  if (!active) return [];

  const crumbs = [active];
  let wanted = active.depth - 1;
  for (let step = index - 1; step >= 0 && wanted >= 0; step--) {
    const entry = entries[step];
    if (entry && entry.depth === wanted) {
      crumbs.unshift(entry);
      wanted -= 1;
    }
  }

  return crumbs;
}

/**
 * A section's child sections as the page may offer them: index order, the ones
 * the document hides left out.
 *
 * Both the test that makes a section a menu and the menu itself read this, so a
 * hidden child can neither turn its parent into a menu nor appear as a way into
 * a page the rail does not list. The design reference has no hidden section and
 * cannot answer this; the rail has listed visible sections only since it was
 * built.
 */
export function visibleChildren(
  section: ConfigurationSection,
): ConfigurationSection[] {
  return orderedSections(section.sections).filter((child) => child.visible);
}

/**
 * Which section the page should stand on, given the one it stands on now and
 * the rail it stood in before.
 *
 * Every change batch returns a whole new document, so the section the buyer was
 * looking at can arrive hidden or gone. Keeping the id would leave the page on
 * an entry the rail no longer lists and the body no longer renders.
 *
 * Where it lands then is the nearest entry *before* it that survived, which on
 * the first entry is the new first one. Sending a buyer who was on section four
 * of five back to the top costs them the walk down again; the section above the
 * one that vanished is next to where they were looking.
 */
export function resolveActiveId(
  entries: SectionEntry[],
  current: string | null,
  previous: SectionEntry[],
): string | null {
  const lists = (id: string | null): boolean =>
    entries.some((entry) => entry.section.id === id);

  if (lists(current)) return current;

  const stood = previous.findIndex((entry) => entry.section.id === current);
  for (let index = stood - 1; index >= 0; index--) {
    const id = previous[index]?.section.id ?? null;
    if (lists(id)) return id;
  }

  return entries[0]?.section.id ?? null;
}

/** Where the marked entry sits, or `-1` when nothing is marked. */
export function activeIndex(
  entries: SectionEntry[],
  activeId: string | null,
): number {
  return entries.findIndex((entry) => entry.section.id === activeId);
}

export function hasPrevious(index: number): boolean {
  return index > 0;
}

export function hasNext(index: number, count: number): boolean {
  return index >= 0 && index < count - 1;
}

/**
 * The id `delta` steps away, clamped rather than wrapped: the buttons are
 * disabled at the ends, and a caller that asks past one anyway should stay
 * where it is rather than jump to the other end of the rail.
 *
 * An empty rail needs no guard of its own: the clamp lands on `-1`, which is
 * the lookup that answers `null`.
 */
export function stepId(
  entries: SectionEntry[],
  index: number,
  delta: number,
): string | null {
  const target = Math.min(Math.max(index + delta, 0), entries.length - 1);
  return entries[target]?.section.id ?? null;
}
