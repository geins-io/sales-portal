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
