import { toValue, type MaybeRefOrGetter } from 'vue';
import { formatPrice, type PriceType } from '#shared/types/commerce';
import { exVatAmount } from '#shared/utils/configurator-price';
import { optionPricePrefix } from '~/utils/configurator-form';
import type { SpecificationValue } from '~/utils/configurator-panel';

/**
 * How a specification writes its values and prices, so the PDP's panel, a
 * line's panel and the copied text read the same.
 */
export function useSpecificationFormat(
  currency: MaybeRefOrGetter<string | undefined>,
) {
  const { t } = useI18n();
  const { formatLocale } = useFormatLocale();
  const { showPrice } = usePriceVisibility();

  function money(net: number): string {
    return formatPrice(net, toValue(currency), formatLocale.value);
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
    if (!value.quantity || value.quantity <= 1) return text;
    return `${text} · ${t('configurator.panel.quantity_suffix', { count: value.quantity })}`;
  }

  /**
   * A price, or nothing. The rule is the option row's: a choice the provider
   * charges nothing for says nothing, rather than a column of zeroes.
   */
  function priceText(price: PriceType): string | null {
    if (!showPrice.value) return null;
    const net = exVatAmount(price);
    const prefix = optionPricePrefix(net);
    if (prefix === null) return null;
    return `${prefix}${money(net)}`;
  }

  function valuePrice(value: SpecificationValue): string | null {
    return value.price ? priceText(value.price) : null;
  }

  return { money, valueText, priceText, valuePrice };
}
