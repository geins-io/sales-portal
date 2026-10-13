import { toValue, type MaybeRefOrGetter } from 'vue';
import { formatPrice } from '#shared/types/commerce';
import { optionPricePrefix } from '~/utils/configurator-form';
import {
  priceBlock,
  valueAmount,
  type PriceTotals,
  type SpecificationValue,
} from '~/utils/configurator-panel';

export interface PriceLines {
  price: string;
  /** VAT, then on the ex side the amount with VAT. */
  rows: { label: string; amount: string }[];
}

/**
 * How a specification writes its values and prices, so the PDP's panel, a
 * line's panel and the copied text read the same, on the side of the buyer's
 * VAT choice.
 */
export function useSpecificationFormat(
  currency: MaybeRefOrGetter<string | undefined>,
) {
  const { t } = useI18n();
  const { formatLocale } = useFormatLocale();
  const { showPrice } = usePriceVisibility();
  const { showIncVat } = useVatDisplay();

  function money(amount: number): string {
    return formatPrice(amount, toValue(currency), formatLocale.value);
  }

  /**
   * A number is written the way the field the buyer typed it in writes it, down
   * to the decimals the provider asked for: the specification is made to be
   * pasted into a mail, and two shapes of the same measurement is a question the
   * reader has to ask.
   */
  function numberText(value: number, decimals: number | undefined): string {
    return new Intl.NumberFormat(formatLocale.value, {
      minimumFractionDigits: decimals ?? 0,
      maximumFractionDigits: decimals ?? 0,
    }).format(value);
  }

  /** A value reads the same on screen and in the copied text. */
  function valueText(value: SpecificationValue): string {
    const written = value.none
      ? t('configurator.none_option')
      : value.boolValue
        ? t('configurator.yes')
        : value.number !== undefined
          ? numberText(value.number, value.decimals)
          : (value.text ?? '');
    const text = value.unit ? `${written} ${value.unit}` : written;
    // Wherever the price is for more or less than one, which a part measured
    // in fractions of a unit is.
    if (!value.quantity || value.quantity === 1) return text;
    const count = new Intl.NumberFormat(formatLocale.value, {
      maximumFractionDigits: 6,
    }).format(value.quantity);
    return `${text} · ${t('configurator.panel.quantity_suffix', { count })}`;
  }

  /**
   * A value's price for every one of it chosen, or nothing. The rule is the
   * option row's: a choice the provider charges nothing for says nothing,
   * rather than a column of zeroes.
   */
  function valuePrice(value: SpecificationValue): string | null {
    if (!showPrice.value || !value.price) return null;
    const amount = valueAmount(value, showIncVat.value);
    const prefix = optionPricePrefix(amount);
    if (prefix === null) return null;
    return `${prefix}${money(amount)}`;
  }

  /** The price block's lines, written and labelled. */
  function priceLines(totals: PriceTotals): PriceLines {
    const block = priceBlock(totals, showIncVat.value);
    const rows = [
      {
        label: t(showIncVat.value ? 'common.vat_included' : 'common.vat'),
        amount: money(block.vat),
      },
    ];
    if (block.totalIncVat !== null) {
      rows.push({
        label: t('configurator.panel.total_inc_vat'),
        amount: money(block.totalIncVat),
      });
    }
    return { price: money(block.price), rows };
  }

  return { money, valueText, valuePrice, priceLines, showIncVat };
}
