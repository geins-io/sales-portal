import type { ListProduct } from '#shared/types/commerce';
import type {
  ConfigurationOption,
  ConfigurationOptionGroup,
  ConfigurationVariable,
} from '#shared/types/configurator';

// ---------------------------------------------------------------------------
// Node builders for the seeds.
//
// Server code cannot reach the test helpers, and it should not: a seed is the
// product the fixture sells, not test data. The defaults below describe an
// untouched single-select row, which is what most rows in a seed are.
// ---------------------------------------------------------------------------

export const CURRENCY = 'SEK';

/**
 * The catalogue product carried on an option row. A real option row embeds the
 * product so no second lookup is needed, and the embedded shape is the portal's
 * ordinary `ListProduct`.
 */
export function seedProduct(spec: {
  id: string;
  name: string;
  productId: number;
  articleNumber: string;
  net: number;
  category: string;
}): ListProduct {
  const incVat = Math.round(spec.net * 1.25);
  return {
    productId: spec.productId,
    name: spec.name,
    alias: spec.id,
    canonicalUrl: `/products/${spec.id}`,
    articleNumber: spec.articleNumber,
    brand: { name: 'Brand' },
    primaryCategory: { name: spec.category },
    unitPrice: {
      sellingPriceIncVat: incVat,
      sellingPriceIncVatFormatted: `${incVat} kr`,
      isDiscounted: false,
    },
    // No image. The parts a configuration is built from — a table top, a RAL
    // colour — have none in the catalogue, and a file name that resolves to
    // nothing renders as a broken-image placeholder on every row.
    productImages: [],
    totalStock: { inStock: 10, oversellable: 0, totalStock: 10, static: 0 },
    skus: [],
    discountCampaigns: [],
  };
}

export function seedOption(
  spec: {
    id: string;
    name: string;
    net: number;
    productId: number;
    article: string;
    category: string;
  },
  overrides: Partial<ConfigurationOption> = {},
): ConfigurationOption {
  const product = seedProduct({
    id: spec.id,
    name: spec.name,
    productId: spec.productId,
    articleNumber: `${spec.article}-${spec.id.toUpperCase()}`,
    net: spec.net,
    category: spec.category,
  });
  return {
    id: spec.id,
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
    unitPrice: { net: spec.net, currency: CURRENCY },
    discountPercent: 0,
    messages: [],
    product,
    ...overrides,
  };
}

export function seedVariable(
  overrides: Partial<ConfigurationVariable> & { id: string; name: string },
): ConfigurationVariable {
  return {
    description: '',
    valueType: 'number',
    value: 0,
    defaultValue: 0,
    required: true,
    available: true,
    decimals: 0,
    selectionSource: 'none',
    valueSource: 'initial',
    messages: [],
    ...overrides,
  };
}

export function seedGroup(
  overrides: Partial<ConfigurationOptionGroup> & {
    id: string;
    code: string;
    name: string;
  },
): ConfigurationOptionGroup {
  return {
    available: true,
    quantityEditable: false,
    optionGroups: [],
    options: [],
    messages: [],
    ...overrides,
  };
}
