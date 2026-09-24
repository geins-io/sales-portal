import type {
  Configuration,
  ConfigurationMessage,
  ConfigurationOptionGroup,
  ConfigurationSection,
  ConfigurationVariable,
} from '#shared/types/configurator';
import type { PriceType } from '#shared/types/commerce';
import {
  isGroupUnmet,
  isVariableUnmet,
} from '#shared/utils/configurator-requirement';
import { orderedSections, sectionMembers } from '~/utils/configurator-order';

// ---------------------------------------------------------------------------
// The derivations the configuration panel renders.
//
// They live here rather than in the component because Stryker produces no
// mutants from a `.vue` file: a derivation written in a template is one nothing
// can prove.
// ---------------------------------------------------------------------------

/**
 * Every error message in the document, as the objects the provider sent, in
 * document order.
 *
 * The walk covers the whole tree because the provider puts them wherever they
 * belong — on a group, on a variable, on a single option — and almost never on
 * the root, so a reader of `configuration.messages` alone would show an invalid
 * configuration with no reason at all.
 *
 * A section the provider hid is skipped whole, nested sections included. Its
 * rules still ran, but nothing in it is on screen, so naming it would tell the
 * buyer to fix something they cannot see.
 *
 * The objects rather than their texts, because two different nodes can carry
 * the same sentence and only identity can tell those apart.
 */
function everyBlockingMessage(config: Configuration): ConfigurationMessage[] {
  const found: ConfigurationMessage[] = [];

  const take = (messages: ConfigurationMessage[]): void => {
    for (const message of messages) {
      if (message.severity === 'error') found.push(message);
    }
  };

  const walkGroup = (group: ConfigurationOptionGroup): void => {
    take(group.messages);
    for (const nested of group.optionGroups) walkGroup(nested);
    for (const option of group.options) take(option.messages);
  };

  const walkSections = (sections: ConfigurationSection[]): void => {
    for (const section of orderedSections(sections)) {
      if (!section.visible) continue;
      take(section.messages);
      for (const member of sectionMembers(section)) {
        if (member.kind === 'group') walkGroup(member.group);
        else take(member.variable.messages);
      }
      walkSections(section.sections);
    }
  };

  take(config.messages);
  walkSections(config.sections);

  return found;
}

/**
 * Every blocking message in the document, in document order, without repeats.
 *
 * Repeats are dropped. Two groups can carry the same sentence, and the same
 * line twice in a list reads as a defect rather than as two problems.
 */
export function collectBlockingMessages(config: Configuration): string[] {
  return [...new Set(everyBlockingMessage(config).map((m) => m.text))];
}

/**
 * What the buyer still has to answer, as the nodes themselves.
 *
 * Derived from the requirement rather than read out of a message: "nothing
 * chosen yet" is a property of the node (`isGroupUnmet`, `isVariableUnmet`),
 * and a document that also stated it in a sentence would have the panel repeat
 * what the group header already says.
 *
 * This is banner text and nothing else. Whether the configuration may be
 * committed is `configuration.isValid`, which the provider decides and
 * `canCommit` reads off the wire; a button driven from this walk would be one
 * the client enabled and the server then refused.
 *
 * Only visible sections, because the banner points at what is on screen. The
 * document's own verdict weighs the hidden ones too, so a configuration can be
 * invalid with nothing for the banner to name — that is what
 * `invalid_unspecified` is for.
 */
function unmetNodes(config: Configuration): {
  names: string[];
  messages: ConfigurationMessage[];
} {
  const names: string[] = [];
  const messages: ConfigurationMessage[] = [];

  const take = (name: string, carried: ConfigurationMessage[]): void => {
    names.push(name);
    messages.push(...carried);
  };

  const walkGroup = (group: ConfigurationOptionGroup): void => {
    if (isGroupUnmet(group)) take(group.name, group.messages);
    for (const nested of group.optionGroups) walkGroup(nested);
  };

  const walkSections = (sections: ConfigurationSection[]): void => {
    for (const section of orderedSections(sections)) {
      if (!section.visible) continue;
      for (const member of sectionMembers(section)) {
        if (member.kind === 'group') walkGroup(member.group);
        else if (isVariableUnmet(member.variable)) {
          take(member.variable.name, member.variable.messages);
        }
      }
      walkSections(section.sections);
    }
  };

  walkSections(config.sections);

  return { names: [...new Set(names)], messages };
}

/** What the banner names as missing, in document order and without repeats. */
export function collectBlockingNames(config: Configuration): string[] {
  return unmetNodes(config).names;
}

/**
 * The blocking messages the banner's sentence does not already stand for: the
 * ones the provider put on the document itself, on a section, on a single
 * option, or on a node that is not waiting for an answer.
 *
 * Matched on identity rather than on text, because a provider sends the same
 * generic sentence from several places and subtracting by text hid the one on
 * an option — which contributes no name — the moment a named group happened to
 * carry the same words.
 *
 * The trade: a group that is both named as missing and carries a real conflict
 * loses that sentence here. It still stands at the group in the form, which is
 * where it belongs, and the alternative is the banner saying the same thing
 * twice.
 */
export function unnamedBlockingMessages(config: Configuration): string[] {
  const covered = new Set(unmetNodes(config).messages);
  return [
    ...new Set(
      everyBlockingMessage(config)
        .filter((message) => !covered.has(message))
        .map((message) => message.text),
    ),
  ];
}

/**
 * Remaining session time as a zero-padded `mm:ss` clock, floored at `0:00`.
 *
 * Past an hour it keeps counting in minutes (`65:04`). A session lasts minutes,
 * so an hours field would be a branch no document can reach.
 */
export function formatRemaining(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// The specification: what has been chosen, grouped the way the form is
// ---------------------------------------------------------------------------

export interface SpecificationValue {
  /** An option's name, or a text variable's value. */
  text?: string;
  /**
   * A numeric variable's value, as the number. The panel formats it the way
   * the field the buyer typed it in does, which needs a locale a pure function
   * has no business holding.
   */
  number?: number;
  /** How many digits that field shows after the separator. */
  decimals?: number;
  /** A boolean variable's value, which only the locale files can word. */
  boolValue?: boolean;
  /** Written after the value, as the field writes it beside the input. */
  unit?: string;
  /** How many of this option; rendered only above one. */
  quantity?: number;
  /** The option's own price. A variable has none: see `specificationRows`. */
  price?: PriceType;
}

export interface SpecificationRow {
  /**
   * The node the row came from, prefixed by kind: a group and a variable of
   * the same section can carry the same id, and two rows with one key is a
   * list Vue patches wrongly.
   */
  id: string;
  /** The section the row was chosen in. */
  group: string;
  label: string;
  /** One entry per selected option, so a multi-select is a list, not a blob. */
  values: SpecificationValue[];
}

/**
 * A variable is worth a row once it holds something that was chosen. Nothing
 * chosen shows nothing: an unset value, an empty text, a zero on an optional
 * measurement and an unticked box are all the same absence to a reader.
 */
function variableValue(
  variable: ConfigurationVariable,
): SpecificationValue | undefined {
  const { value } = variable;
  const unit = variable.unit ? { unit: variable.unit } : {};

  if (typeof value === 'boolean') {
    return value ? { boolValue: true } : undefined;
  }
  if (typeof value === 'number') {
    if (value === 0) return undefined;
    return { number: value, decimals: variable.decimals, ...unit };
  }
  if (typeof value === 'string' && value !== '')
    return { text: value, ...unit };
  return undefined;
}

function groupRows(
  groups: ConfigurationOptionGroup[],
  section: string,
): SpecificationRow[] {
  const rows: SpecificationRow[] = [];

  for (const group of groups) {
    // A selected option the rules made unavailable is still part of the
    // configuration, exactly as a collapsed group counts it.
    const selected = group.options.filter((option) => option.selected);
    if (selected.length) {
      rows.push({
        id: `group:${group.id}`,
        group: section,
        label: group.name,
        values: selected.map((option) => ({
          text: option.name,
          quantity: option.quantity,
          price: option.unitPrice,
        })),
      });
    }
    rows.push(...groupRows(group.optionGroups, section));
  }

  return rows;
}

function sectionRows(sections: ConfigurationSection[]): SpecificationRow[] {
  const rows: SpecificationRow[] = [];

  for (const section of orderedSections(sections)) {
    if (!section.visible) continue;

    // The order `ConfiguratorSection` renders, so the specification reads in
    // the order the form was filled in. Nested sections follow both, because
    // the form cannot put a child's page inside its parent's.
    for (const member of sectionMembers(section)) {
      if (member.kind === 'group') {
        rows.push(...groupRows([member.group], section.name));
        continue;
      }
      const value = variableValue(member.variable);
      if (!value) continue;
      rows.push({
        id: `variable:${member.variable.id}`,
        group: section.name,
        label: member.variable.name,
        values: [value],
      });
    }

    rows.push(...sectionRows(section.sections));
  }

  return rows;
}

/**
 * Every choice in the document as a row, grouped by the section it was made in.
 *
 * Grouped by section rather than by a kind of choice: the document has no level
 * between the section and the option group, and the section is what the buyer
 * just filled in on the left.
 *
 * A variable carries no price. The provider prices the configuration as a
 * whole, and what a variable adds is computed where the rules run — it is not
 * on the wire, so a number here would be one the portal made up.
 */
export function specificationRows(config: Configuration): SpecificationRow[] {
  return sectionRows(config.sections);
}

/** The rows by group, in the order the groups first appear. */
export function groupSpecificationRows(
  rows: SpecificationRow[],
): [string, SpecificationRow[]][] {
  const groups = new Map<string, SpecificationRow[]>();
  for (const row of rows) {
    const existing = groups.get(row.group);
    if (existing) existing.push(row);
    else groups.set(row.group, [row]);
  }
  return [...groups.entries()];
}

export interface SpecificationTextInput {
  productName: string;
  articleNumber: string;
  /** Already translated, because a pure function has no locale. */
  quantityLine: string;
  rows: SpecificationRow[];
  /** What a value reads as on screen, so the text and the panel agree. */
  formatValue: (value: SpecificationValue) => string;
  /** `null` where the panel renders no price either. */
  formatPrice: (price: PriceType) => string | null;
  /** Absent when the buyer may not see prices. */
  price?: { label: string; amount: string; note: string };
}

/**
 * The specification as plain text, so it survives a paste into mail or a
 * ticket. A configuration has no id of its own until it becomes a quote, so
 * until then this text is the only handle on what was built.
 */
export function specificationText(input: SpecificationTextInput): string {
  const lines = [
    `${input.productName} (${input.articleNumber})`,
    input.quantityLine,
    '',
  ];

  for (const [group, rows] of groupSpecificationRows(input.rows)) {
    lines.push(group.toUpperCase());
    for (const row of rows) {
      lines.push(`  ${row.label}:`);
      for (const value of row.values) {
        const price = value.price ? input.formatPrice(value.price) : null;
        lines.push(
          `    ${input.formatValue(value)}${price ? `  (${price})` : ''}`,
        );
      }
    }
    lines.push('');
  }

  if (input.price) {
    lines.push(`${input.price.label}: ${input.price.amount}`);
    lines.push(input.price.note);
  }

  return lines.join('\n');
}
