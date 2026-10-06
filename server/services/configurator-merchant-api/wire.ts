import type { ListProduct, PriceType } from '#shared/types/commerce';

// ---------------------------------------------------------------------------
// The CPQ area as merchant-api's schema declares it (introspected 2026-09-24).
//
// Every id and most fields are nullable on the wire. Enums are typed as open
// strings: a value added upstream must reach the mapper, which keeps it as
// `unknown` rather than failing the document. A `Decimal` may arrive as a
// number or a string depending on the serializer, so both are accepted.
// ---------------------------------------------------------------------------

export type WireDecimal = number | string;

/** The `CpqValue` scalar: the variable's value in whatever form it was sent. */
export type WireValue = string | number | boolean | null;

export interface WireMessage {
  /** `ERROR` | `WARNING` | `INFO` | `UNKNOWN` */
  severity: string;
  text: string | null;
}

type WireList<T> = (T | null)[] | null;

export interface WireVariable {
  id: string | null;
  name: string | null;
  description: string | null;
  /** `STRING` | `NUMBER` | `BOOLEAN` | `DATE` | `UNKNOWN` */
  valueType: string;
  value: WireValue;
  defaultValue: WireValue;
  required: boolean;
  available: boolean;
  readOnly: boolean;
  min: WireDecimal | null;
  max: WireDecimal | null;
  step: WireDecimal | null;
  decimals: number | null;
  unit: string | null;
  selectionSource: string;
  valueSource: string;
  sortIndex: number | null;
  messages: WireList<WireMessage>;
}

export interface WireOption {
  id: string | null;
  instanceId: string | null;
  articleNumber: string | null;
  name: string | null;
  description: string | null;
  selected: boolean;
  available: boolean;
  readOnly: boolean;
  selectionSource: string;
  quantity: WireDecimal;
  defaultQuantity: WireDecimal;
  minQuantity: WireDecimal | null;
  maxQuantity: WireDecimal | null;
  unitPrice: PriceType | null;
  discountPercent: WireDecimal | null;
  /** Selected with the `ListProduct` fragment. */
  product: ListProduct | null;
  messages: WireList<WireMessage>;
}

export interface WireOptionGroup {
  id: string | null;
  code: string | null;
  name: string | null;
  description: string | null;
  available: boolean;
  minSelections: number | null;
  maxSelections: number | null;
  minQuantity: WireDecimal | null;
  maxQuantity: WireDecimal | null;
  quantityEditable: boolean;
  sortIndex: number | null;
  optionGroups: WireList<WireOptionGroup>;
  options: WireList<WireOption>;
  messages: WireList<WireMessage>;
}

export interface WireSection {
  id: string | null;
  name: string | null;
  description: string | null;
  visible: boolean;
  sortIndex: number | null;
  sections: WireList<WireSection>;
  variables: WireList<WireVariable>;
  optionGroups: WireList<WireOptionGroup>;
  messages: WireList<WireMessage>;
}

export interface WireConfiguration {
  configurationId: string;
  expiresAt: string;
  isValid: boolean;
  articleNumber: string | null;
  quantity: WireDecimal;
  unitPrice: PriceType | null;
  discountPercent: WireDecimal | null;
  weightPerUnit: WireDecimal | null;
  templateId: string | null;
  templateVersion: string | null;
  messages: WireList<WireMessage>;
  sections: WireList<WireSection>;
}

/** `CpqConfigurationChangeInputType`: one input type for every kind of change. */
export type WireChange =
  | { type: 'VARIABLE'; variableId: string; value: WireValue }
  | {
      type: 'OPTION';
      optionId: string;
      instanceId: string;
      selected: boolean;
      quantity?: number;
      lock: 'NONE' | 'LOCK' | 'UNLOCK';
    }
  | { type: 'QUANTITY'; quantity: number };

/** `CpqCommittedConfigurationLineType`: one row of the frozen summary. */
export interface WireSummaryLine {
  label: string | null;
  value: string | null;
}

/** `CpqCommittedConfigurationType`, as far as the commit mutation selects it. */
export interface WireCommittedConfiguration {
  committedConfigurationId: string;
  configurationId: string | null;
  articleNumber: string | null;
  quantity: WireDecimal;
  unitPrice: PriceType | null;
  discountPercent: WireDecimal | null;
  weightPerUnit: WireDecimal | null;
  summary: WireList<WireSummaryLine>;
}

/** `CartItemType`, as far as the cart-line read selects it. */
export interface WireCartLine {
  id: string | null;
  quantity: number | null;
  configurationId: string | null;
  configuration: { summary: WireList<WireSummaryLine> } | null;
}

/** `CartType`, as far as the cart-line read selects it. */
export interface WireCartLines {
  items: WireList<WireCartLine>;
}

/** An order's `CartItemType`, as far as the order-row read selects it. */
export interface WireOrderLine {
  product?: { productId: number | null; type?: string | null } | null;
  configuration: { summary: WireList<WireSummaryLine> } | null;
}

/** `OrderType`, as far as the order-row read selects it. */
export interface WireOrderLines {
  cart: { items: WireList<WireOrderLine> } | null;
}

/** `CpqCommittedVariableType`: the value in invariant culture, without the unit. */
export interface WireCommittedVariable {
  id: string | null;
  /** `STRING` | `NUMBER` | `BOOLEAN` | `DATE` | `UNKNOWN` */
  valueType: string;
  value: string | null;
}

/** `CpqCommittedOptionType`, as far as the replay read selects it. */
export interface WireCommittedOption {
  id: string | null;
  instanceId: string | null;
  quantity: WireDecimal;
}

/** `CpqCommittedOptionGroupType`: only groups holding a selection. */
export interface WireCommittedOptionGroup {
  id: string | null;
  options: WireList<WireCommittedOption>;
  optionGroups?: WireList<WireCommittedOptionGroup>;
}

/** `CpqCommittedSectionType`: only what the buyer saw and chose. */
export interface WireCommittedSection {
  id: string | null;
  variables: WireList<WireCommittedVariable>;
  optionGroups: WireList<WireCommittedOptionGroup>;
  sections?: WireList<WireCommittedSection>;
}

/** An order's `CartItemType`, as far as the replay read selects it. */
export interface WireOrderChoiceLine {
  product?: { productId: number | null } | null;
  configuration: { sections: WireList<WireCommittedSection> } | null;
}

/** `OrderType`, as far as the replay read selects it. */
export interface WireOrderChoiceLines {
  cart: { items: WireList<WireOrderChoiceLine> } | null;
}
