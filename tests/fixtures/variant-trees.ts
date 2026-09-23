import type { VariantNode } from '#shared/types/commerce';

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
