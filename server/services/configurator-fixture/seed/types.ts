import type {
  Configuration,
  ConfigurationSection,
} from '#shared/types/configurator';

/**
 * A seeded configurable product: the document it starts as, plus the three
 * things the document itself cannot carry — what a variable costs, which
 * variables the provider computes, and the rules it re-runs after every change.
 */
export interface Seed {
  /** The provider's part id, which the document carries. */
  productId: string;
  /**
   * The catalogue product this seed stands for, as its Geins product id. The
   * portal names a product by that id everywhere, and translating it to the
   * part id above is the backend's job — here, this field. It is also what
   * tells the products service the product is configurable while the merchant
   * API has no field of its own.
   */
  geinsProductId: string;
  templateId: string;
  templateVersion: string;
  basePrice: number;
  /** A percentage, as Geins writes `discountPercentage`. */
  vatRate: number;
  weightPerUnit: number;
  /**
   * Net money per unit of a variable's value above its default. The document
   * has no price field on a variable, and the real provider prices
   * multiplicatively server-side, so this is the mock's arithmetic only.
   */
  variableRates: Record<string, number>;
  /** Variables the provider owns. A change aimed at one is refused. */
  formulas: Record<string, (config: Configuration) => number>;
  /** Applied in order, on a freshly built document, after every change batch. */
  cascades: ((config: Configuration) => void)[];
  /** A new set of nodes on every call — the engine mutates what it gets. */
  buildSections: () => ConfigurationSection[];
}
