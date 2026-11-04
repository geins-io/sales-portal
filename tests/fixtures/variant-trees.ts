import type { VariantNode } from '#shared/types/commerce';
import type { VariantCombination } from '../../app/utils/variant-tree';

// Trimmed copies of live `variantGroup.variants` payloads. `value` is the
// lowercased `label` on every tenant measured, so the two differ on purpose.

const stock = (totalStock: number) => ({
  inStock: totalStock,
  oversellable: 0,
  totalStock,
  static: 0,
});

const skuLeaf = (productId: number, value: string): VariantNode => ({
  dimension: 'DefaultSku',
  value,
  level: 0,
  alias: null,
  productId,
  skuId: productId,
});

/** One dimension: the top node is the product node. */
export const oneDimensionTree: VariantNode[] = [
  {
    dimension: 'Dimension',
    value: '20 mm',
    label: '20 mm',
    level: 1,
    alias: 'glidlager-brons-20-mm',
    productId: 1075,
    stock: stock(4),
    variants: [skuLeaf(1075, '20 mm')],
  },
  {
    dimension: 'Dimension',
    value: '25 mm',
    label: '25 mm',
    level: 1,
    alias: 'glidlager-brons-25-mm',
    productId: 1076,
    stock: stock(0),
    variants: [skuLeaf(1076, '25 mm')],
  },
];

const threadNode = (
  value: string,
  length: string,
  alias: string,
  productId: number,
): VariantNode => ({
  dimension: 'Gänga',
  value,
  label: value.toUpperCase(),
  level: 2,
  alias: null,
  productId: 0,
  variants: [
    {
      dimension: 'Längd',
      value: length,
      label: length,
      level: 1,
      alias,
      productId,
      stock: stock(productId === 1006 ? 0 : 7),
      variants: [skuLeaf(productId, `${value}x${length}`)],
    },
  ],
});

/** Two dimensions: the alias sits one level down, under an alias-less node. */
export const twoDimensionTree: VariantNode[] = [
  threadNode('m10', '50 mm', 'sexkantskruv-m10x50-din-933-rostfri-a2', 1007),
  threadNode('m12', '60 mm', 'sexkantskruv-m12x60-din-933-rostfri-a2', 1008),
  threadNode('m8', '40 mm', 'sexkantskruv-m8x40-din-933-rostfri-a2', 1006),
];

const voltageNode = (
  value: string,
  label: string,
  alias: string,
  productId: number,
): VariantNode => ({
  dimension: 'Spänning',
  value,
  label,
  level: 1,
  alias,
  productId,
  stock: stock(25),
  variants: [skuLeaf(productId, alias)],
});

/**
 * Two dimensions where three of the four combinations exist: 0,66 kW comes
 * only in 150 V. Every variant stays reachable by changing one selector.
 */
export const partialGridTree: VariantNode[] = [
  {
    dimension: 'Effekt',
    value: '0,37 kw',
    label: '0,37 kW',
    level: 2,
    alias: null,
    productId: 0,
    variants: [
      voltageNode('150 v', '150 V', 'pump-0-37-kw-150-v', 1001),
      voltageNode('400 v', '400 V', 'pump-0-37-kw-400-v', 1002),
    ],
  },
  {
    dimension: 'Effekt',
    value: '0,66 kw',
    label: '0,66 kW',
    level: 2,
    alias: null,
    productId: 0,
    variants: [voltageNode('150 v', '150 V', 'pump-0-66-kw-150-v', 1003)],
  },
];

/** Two dimensions where one length comes in two threads: 30 mm in M6 and M8. */
export const sharedValueTree: VariantNode[] = [
  threadNode('m10', '40 mm', 'sexkantskruv-m10x40-din-933-elforzinkad', 1001),
  threadNode('m6', '30 mm', 'sexkantskruv-m6x30-din-933-elforzinkad', 1002),
  threadNode('m8', '30 mm', 'sexkantskruv-m8x30-din-933-elforzinkad', 1003),
];

const flat = (
  alias: string,
  selection: Record<string, string>,
): VariantCombination => ({
  alias,
  productId: null,
  selection,
  labels: selection,
  stock: null,
});

/** The switch test group: Poler × Kapsling × Märkström, 12 of 16. */
export const switchCombinations: VariantCombination[] = [
  ['3P', 'IP65', '16 A'],
  ['3P', 'IP66', '16 A'],
  ['4P', 'IP65', '16 A'],
  ['4P', 'IP66', '16 A'],
  ['3P', 'IP65', '25 A'],
  ['3P', 'IP66', '25 A'],
  ['4P', 'IP65', '25 A'],
  ['4P', 'IP66', '25 A'],
  ['3P', 'IP66', '40 A'],
  ['4P', 'IP65', '40 A'],
  ['4P', 'IP66', '40 A'],
  ['4P', 'IP66', '63 A'],
].map(([p, ip, a]) =>
  flat(`${a}-${p}-${ip}`, { Poler: p!, Kapsling: ip!, Märkström: a! }),
);

/** The pump test group: Effekt × Spänning, 5 of 6. */
export const pumpCombinations: VariantCombination[] = [
  ['0,37 kW', '230 V'],
  ['0,37 kW', '400 V'],
  ['0,75 kW', '400 V'],
  ['1,5 kW', '230 V'],
  ['1,5 kW', '400 V'],
].map(([kw, v]) => flat(`${kw}-${v}`, { Effekt: kw!, Spänning: v! }));
