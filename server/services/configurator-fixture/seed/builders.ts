import type { ListProduct, PriceType } from '#shared/types/commerce';
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

/** Money arithmetic on floats needs a rounding step, or 1.5 × 3 drifts. */
export function round(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * A price in the shape the real contract sends every price in. The fixture
 * knows only the ex-VAT selling price; the rest follows from the seed's VAT
 * rate and, for a discounted row, from the list price the discount came off.
 */
export function seedPrice(
  exVat: number,
  vatRate: number,
  discountPercent = 0,
): PriceType {
  const incVat = (amount: number) => round(amount * (1 + vatRate / 100));
  const regularPriceExVat = round(exVat / (1 - discountPercent / 100));
  const sellingPriceIncVat = incVat(exVat);
  return {
    sellingPriceExVat: exVat,
    sellingPriceIncVat,
    regularPriceExVat,
    regularPriceIncVat: incVat(regularPriceExVat),
    vat: round(sellingPriceIncVat - exVat),
    isDiscounted: discountPercent > 0,
    discountPercentage: discountPercent,
    currency: { code: CURRENCY, symbol: 'kr' },
  };
}

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
    vatRate: number;
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
  const discountPercent = overrides.discountPercent ?? 0;
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
    unitPrice: seedPrice(spec.net, spec.vatRate, discountPercent),
    discountPercent,
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
