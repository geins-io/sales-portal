import type { SummaryRowKey } from '#shared/types/portal-rows';

/** How a summary row looks in a lines table's footer. */
export interface FooterStyle {
  row?: string;
  label: string;
  value: string;
  /** Whether the value cell carries the table's `…-footer-<key>` test id. */
  testId: boolean;
}

const FOOTER_DEFAULT: FooterStyle = {
  label: 'text-muted-foreground px-4 py-3 text-right text-sm',
  value: 'px-4 py-3 text-right text-sm',
  testId: true,
};
const FOOTER: Partial<Record<SummaryRowKey, FooterStyle>> = {
  subtotal: { ...FOOTER_DEFAULT, testId: false },
  tax: { ...FOOTER_DEFAULT, testId: false },
  discount: {
    label: 'text-danger px-4 py-3 text-right text-sm',
    value: 'text-danger px-4 py-3 text-right text-sm font-medium',
    testId: true,
  },
  total: {
    row: 'border-border border-t',
    label: 'px-4 py-5 text-right text-sm font-semibold',
    value: 'px-4 py-5 text-right text-sm font-semibold',
    testId: true,
  },
  'total-inc-vat': {
    label: 'text-muted-foreground px-4 pb-5 text-right text-sm',
    value: 'text-muted-foreground px-4 pb-5 text-right text-sm',
    testId: true,
  },
};

export const footerOf = (key: SummaryRowKey): FooterStyle =>
  FOOTER[key] ?? FOOTER_DEFAULT;

// An object, not `:class`: a bound class renders `class=""` where it has none.
export const footerRowAttrs = (key: SummaryRowKey) => {
  const row = footerOf(key).row;
  return row ? { class: row } : {};
};
