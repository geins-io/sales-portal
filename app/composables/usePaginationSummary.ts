import { computed, type ComputedRef, type Ref } from 'vue';

type Noun = 'orders' | 'quotes' | 'products' | 'lists';

/**
 * Reactive "X of Y orders" summary used under portal tables.
 *
 * Centralises wording + i18n so every list page renders the same
 * Figma-aligned format. Add a new noun by extending the union and the
 * `pagination.nouns.*` i18n key.
 */
export function usePaginationSummary(
  shown: Ref<number> | ComputedRef<number>,
  total: Ref<number> | ComputedRef<number>,
  noun: Noun,
): ComputedRef<string> {
  const { t } = useI18n();
  return computed(() =>
    t('pagination.count_summary', {
      shown: shown.value,
      total: total.value,
      noun: t(`pagination.nouns.${noun}`),
    }),
  );
}
