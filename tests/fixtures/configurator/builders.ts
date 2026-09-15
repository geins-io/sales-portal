import type {
  Configuration,
  ConfigurationOption,
  ConfigurationOptionGroup,
  ConfigurationSection,
  ConfigurationVariable,
} from '#shared/types/configurator';
import { makeListProduct } from '../product';

// ---------------------------------------------------------------------------
// Shared plumbing for the example configuration documents.
//
// The finders live here rather than in a spec because the documents are built
// by deriving one from another: `cascaded` and `invalid` are `initial` with
// named nodes changed, and the specs address the same nodes the same way.
// ---------------------------------------------------------------------------

export const CURRENCY = 'SEK';

/**
 * A full option row. Defaults describe an untouched, single-select row, which
 * is what most rows in the seed are; override at the call site, never here.
 */
export function makeConfigurationOption(
  overrides: Partial<ConfigurationOption> = {},
): ConfigurationOption {
  const id = overrides.id ?? 'option';
  const product = overrides.product ?? makeListProduct();
  return {
    id,
    instanceId: '0',
    // The provider's part id is Int64 on the wire and is not the catalogue
    // product id; they are deliberately different numbers here.
    productId: String(900_000_000_000 + product.productId),
    selected: false,
    available: true,
    selectionSource: 'none',
    quantity: 1,
    defaultQuantity: 1,
    minQuantity: 1,
    maxQuantity: 1,
    unitPrice: { net: 0, currency: CURRENCY },
    discountPercent: 0,
    messages: [],
    product,
    ...overrides,
  };
}

function everySection(config: Configuration): ConfigurationSection[] {
  const collect = (sections: ConfigurationSection[]): ConfigurationSection[] =>
    sections.flatMap((section) => [section, ...collect(section.sections)]);
  return collect(config.sections);
}

function everyGroup(config: Configuration): ConfigurationOptionGroup[] {
  const collect = (
    groups: ConfigurationOptionGroup[],
  ): ConfigurationOptionGroup[] =>
    groups.flatMap((group) => [group, ...collect(group.optionGroups)]);
  return everySection(config).flatMap((section) =>
    collect(section.optionGroups),
  );
}

/** Throws rather than returning undefined: a missing node is a broken fixture. */
export function findOptionGroup(
  config: Configuration,
  id: string,
): ConfigurationOptionGroup {
  const group = everyGroup(config).find((candidate) => candidate.id === id);
  if (!group) throw new Error(`No option group '${id}' in the configuration`);
  return group;
}

export function findOption(
  config: Configuration,
  id: string,
): ConfigurationOption {
  const option = everyGroup(config)
    .flatMap((group) => group.options)
    .find((candidate) => candidate.id === id);
  if (!option) throw new Error(`No option '${id}' in the configuration`);
  return option;
}

export function findVariable(
  config: Configuration,
  id: string,
): ConfigurationVariable {
  const variable = everySection(config)
    .flatMap((section) => section.variables)
    .find((candidate) => candidate.id === id);
  if (!variable) throw new Error(`No variable '${id}' in the configuration`);
  return variable;
}
