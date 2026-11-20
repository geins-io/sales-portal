import {
  effectiveListDefaultSort,
  SORT_LABEL_KEYS,
  sortValuesFor,
} from '#shared/utils/filters';

/**
 * Sort state for a product list (category, brand, `/products`). The default
 * is the store setting; a visitor who has not picked a sort follows it, so a
 * price default applies once prices show after login.
 */
export function useListSort() {
  const route = useRoute();
  const { t } = useI18n();
  const { tenant } = useTenant();
  const { showPrice } = usePriceVisibility();

  const defaultSort = computed(() =>
    effectiveListDefaultSort(
      tenant.value?.productList?.defaultSort,
      showPrice.value,
    ),
  );
  const picked = ref<string | null>(
    typeof route.query.sort === 'string' ? route.query.sort : null,
  );
  const sortBy = computed({
    get: () => picked.value ?? defaultSort.value,
    set: (value: string) => {
      picked.value = value;
    },
  });
  const sortOptions = computed(() =>
    sortValuesFor('list', showPrice.value).map((value) => ({
      label: t(SORT_LABEL_KEYS[value]),
      value,
    })),
  );
  /** The `?sort=` value; absent while the list shows its default. */
  const sortParam = computed(() =>
    sortBy.value === defaultSort.value ? undefined : sortBy.value,
  );

  return { sortBy, sortOptions, sortParam };
}
