import type {
  Configuration,
  ConfigurationOptionGroup,
  ConfigurationSection,
  ConfigurationSummaryLine,
  ConfigurationVariable,
} from '#shared/types/configurator';

// ---------------------------------------------------------------------------
// What a committed configuration shows on a cart line.
//
// The rows merchant-api sends, measured on a real account: one per option
// group holding a choice, its choices' names joined by ", " without their
// quantities, and one per variable, a number with two decimals and its unit,
// moved or not. A group with nothing chosen and a hidden section are left out,
// and no row carries a price.
//
// Not measured, so chosen here: an unavailable or empty variable is left out,
// a value that is not a number is shown as it is, the two decimals do not
// follow the variable's `decimals`, a hidden section takes its visible children
// with it, a nested group follows its parent, and a section's groups and
// variables interleave by `sortIndex`.
// ---------------------------------------------------------------------------

function groupRows(
  group: ConfigurationOptionGroup,
): ConfigurationSummaryLine[] {
  const chosen = group.options.filter((option) => option.selected);
  return [
    ...(chosen.length > 0
      ? [
          {
            label: group.name,
            value: chosen.map((option) => option.name).join(', '),
          },
        ]
      : []),
    ...group.optionGroups.flatMap(groupRows),
  ];
}

function variableRows(
  variable: ConfigurationVariable,
): ConfigurationSummaryLine[] {
  const { value, unit } = variable;
  if (!variable.available || value === null || value === '') return [];
  const shown = typeof value === 'number' ? value.toFixed(2) : String(value);
  return [{ label: variable.name, value: unit ? `${shown} ${unit}` : shown }];
}

const LAST = Number.MAX_SAFE_INTEGER;

/** A section's own members in `sortIndex` order, null last, groups first on a tie. */
function sectionRows(
  section: ConfigurationSection,
): ConfigurationSummaryLine[] {
  if (!section.visible) return [];
  const members = [
    ...section.optionGroups.map((group) => ({
      sortIndex: group.sortIndex ?? LAST,
      rows: () => groupRows(group),
    })),
    ...section.variables.map((variable) => ({
      sortIndex: variable.sortIndex ?? LAST,
      rows: () => variableRows(variable),
    })),
  ];
  return [
    ...members
      .sort((a, b) => a.sortIndex - b.sortIndex)
      .flatMap((member) => member.rows()),
    ...section.sections.flatMap(sectionRows),
  ];
}

export function buildSummary(
  config: Configuration,
): ConfigurationSummaryLine[] {
  return config.sections.flatMap(sectionRows);
}
