// ---------------------------------------------------------------------------
// CPQ product configuration document
//
// Mirrors the `Configuration` document of the CPQ service (Configure, Price,
// Quote), which is the authority for every name here. The nested types carry a
// `Configuration` prefix because every export from shared/types is auto-imported
// as an ambient global: a bare `Option` would shadow the DOM's.
//
// The rule engine is not on the wire and cannot be replicated client-side. The
// UI derives everything it needs from the outcome instead: disabled from
// `available: false`, read-only from `selectionSource: locked |
// temporarilyLocked`, hidden from `visible: false`, and the reason from
// `messages`. Every change returns the whole re-evaluated document — replace
// local state, never patch it.
// ---------------------------------------------------------------------------
import type { ListProduct, PriceType } from './commerce';

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------
/**
 * Why an option is selected or not. `none` is the resting value of an untouched
 * row and the most common value on the wire.
 */
export type SelectionSource =
  | 'none'
  | 'initial'
  | 'manual'
  | 'ruleSelected'
  | 'ruleDeselected'
  | 'groupRule'
  | 'locked'
  | 'temporarilyLocked'
  | 'unknown';

/** Why a variable holds the value it holds. */
export type ValueSource =
  | 'initial'
  | 'manual'
  | 'formula'
  | 'linked'
  | 'fallback'
  | 'unknown';

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------
/** The provider's `Valid` kind is dropped upstream, so only these two arrive. */
export interface ConfigurationMessage {
  severity: 'warning' | 'error';
  text: string;
}

// ---------------------------------------------------------------------------
// Variables
// ---------------------------------------------------------------------------
export type ConfigurationValueType = 'string' | 'number' | 'boolean' | 'date';

/** A `date` arrives as an ISO 8601 string; `null` means unset. */
export type ConfigurationValue = string | number | boolean | null;

export interface ConfigurationVariable {
  id: string;
  name: string;
  /**
   * Orders this node against every other member of the same parent — a
   * section's variables, option groups and child sections share one sequence.
   * Null sorts last. `ConfigurationOption` has none and cannot: the provider
   * numbers a row inside its own group, so there is no number to place a row
   * against a nested group on.
   */
  sortIndex?: number | null;
  description: string;
  valueType: ConfigurationValueType;
  value: ConfigurationValue;
  defaultValue: ConfigurationValue;
  required: boolean;
  available: boolean;
  /** The provider's own flag, apart from `selectionSource`; either makes it read-only. */
  readOnly: boolean;
  /** The provider narrows these by rule and returns the narrowed bounds. */
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  unit?: string;
  selectionSource: SelectionSource;
  /** The provider's own value, which a string union cannot carry. */
  selectionSourceRaw?: string;
  valueSource: ValueSource;
  valueSourceRaw?: string;
  messages: ConfigurationMessage[];
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------
export interface ConfigurationOption {
  id: string;
  /** Distinguishes the rows of a group that can hold the same part twice. */
  instanceId: string;
  /** The provider's part number — how the provider knows the row's part. */
  articleNumber: string;
  name: string;
  description: string;
  selected: boolean;
  available: boolean;
  /** The provider's own flag, apart from `selectionSource`; either makes it read-only. */
  readOnly: boolean;
  selectionSource: SelectionSource;
  selectionSourceRaw?: string;
  quantity: number;
  defaultQuantity: number;
  minQuantity?: number;
  maxQuantity?: number;
  /** Already net of `discountPercent`, which travels beside it as information. */
  unitPrice: PriceType;
  discountPercent: number;
  messages: ConfigurationMessage[];
  /**
   * The catalogue product, embedded so no second lookup is needed. Null when
   * the part is not a sellable article, which is most rows on a real product.
   */
  product: ListProduct | null;
}

export interface ConfigurationOptionGroup {
  id: string;
  code: string;
  name: string;
  description: string;
  sortIndex?: number | null;
  available: boolean;
  minSelections?: number;
  /** `1` means single-select. */
  maxSelections?: number;
  minQuantity?: number;
  maxQuantity?: number;
  quantityEditable: boolean;
  optionGroups: ConfigurationOptionGroup[];
  options: ConfigurationOption[];
  messages: ConfigurationMessage[];
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------
export interface ConfigurationSection {
  id: string;
  name: string;
  description: string;
  sortIndex?: number | null;
  visible: boolean;
  sections: ConfigurationSection[];
  variables: ConfigurationVariable[];
  optionGroups: ConfigurationOptionGroup[];
  messages: ConfigurationMessage[];
}

// ---------------------------------------------------------------------------
// The document
// ---------------------------------------------------------------------------
export interface Configuration {
  configurationId: string;
  /** ISO 8601. A session expires; an expired one answers 410. */
  expiresAt: string;
  isValid: boolean;
  /** The provider's part number for the configured product, as the document carries it. */
  articleNumber: string;
  quantity: number;
  unitPrice: PriceType;
  discountPercent: number;
  weightPerUnit?: number;
  /** Provider template and version, opaque to callers. */
  templateId: string;
  templateVersion: string;
  messages: ConfigurationMessage[];
  sections: ConfigurationSection[];
}

// ---------------------------------------------------------------------------
// Changes
//
// Applied as one batch; the response is the whole new document.
// ---------------------------------------------------------------------------
export type ConfigurationChange =
  | { type: 'variable'; variableId: string; value: ConfigurationValue }
  | {
      type: 'option';
      optionId: string;
      instanceId: string;
      selected: boolean;
      quantity: number;
      lock: 'none' | 'lock' | 'unlock';
    }
  | { type: 'quantity'; quantity: number };

// ---------------------------------------------------------------------------
// Session boundaries
// ---------------------------------------------------------------------------
/**
 * Customer, company and currency are resolved server-side from the session.
 *
 * `productId` is the Geins product id — the id the portal knows a product by
 * everywhere. Translating it to the provider's own part id is the backend's
 * job, never the caller's.
 */
export interface CreateConfigurationInput {
  productId: string;
  quantity: number;
}

export interface ConfigurationSummaryLine {
  label: string;
  value: string;
  price?: PriceType;
}

/**
 * A frozen snapshot a cart line references. A configured result has no article
 * number of its own; it is a row referencing the configurable product.
 */
export interface CommittedConfiguration {
  committedConfigurationId: string;
  configurationId: string;
  productId: string;
  quantity: number;
  unitPrice: PriceType;
  summary: ConfigurationSummaryLine[];
}
