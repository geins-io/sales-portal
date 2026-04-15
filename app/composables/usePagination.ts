import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';

interface UsePaginationOptions<T> {
  /** Getter returning the full source array (any reactive dep). */
  source: () => T[];
  /** Fixed number or reactive ref — items per page. */
  pageSize: number | Ref<number>;
  /**
   * Optional list of getters whose change resets currentPage to 1.
   * Useful for search query / filter sources.
   */
  resetOn?: Array<() => unknown>;
}

interface UsePaginationReturn<T> {
  currentPage: Ref<number>;
  pageSize: ComputedRef<number>;
  totalPages: ComputedRef<number>;
  paginatedItems: ComputedRef<T[]>;
  showPagination: ComputedRef<boolean>;
  goToPage: (page: number) => void;
}

/**
 * Client-side slice pagination with reset + clamp watchers.
 *
 * Handles the common shape shared by the portal product/order/quote lists:
 * - `currentPage` starts at 1
 * - `totalPages` is derived from `source().length / pageSize`
 * - `paginatedItems` is a slice of the source for the current page
 * - `goToPage` clamps out-of-range requests
 * - When `totalPages` shrinks (e.g. after filtering), `currentPage` snaps down
 * - When any `resetOn` getter changes, `currentPage` resets to 1
 * - When a reactive `pageSize` changes, `currentPage` resets to 1
 */
export function usePagination<T>(
  options: UsePaginationOptions<T>,
): UsePaginationReturn<T> {
  const currentPage = ref(1);

  const pageSizeRef = computed(() =>
    typeof options.pageSize === 'number'
      ? options.pageSize
      : options.pageSize.value,
  );

  const totalPages = computed(() =>
    Math.max(1, Math.ceil(options.source().length / pageSizeRef.value)),
  );

  const paginatedItems = computed(() => {
    const start = (currentPage.value - 1) * pageSizeRef.value;
    return options.source().slice(start, start + pageSizeRef.value);
  }) as ComputedRef<T[]>;

  const showPagination = computed(
    () => options.source().length > pageSizeRef.value,
  );

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages.value) {
      currentPage.value = page;
    }
  }

  // Clamp watcher: if totalPages shrinks below currentPage, snap back.
  watch(totalPages, (n) => {
    if (currentPage.value > n) {
      currentPage.value = n;
    }
  });

  // Reset watcher: any listed source change resets to page 1.
  if (options.resetOn?.length) {
    watch(options.resetOn, () => {
      currentPage.value = 1;
    });
  }

  // Reactive pageSize resets to 1 when size changes.
  if (typeof options.pageSize !== 'number') {
    watch(pageSizeRef, () => {
      currentPage.value = 1;
    });
  }

  return {
    currentPage,
    pageSize: pageSizeRef,
    totalPages,
    paginatedItems,
    showPagination,
    goToPage,
  };
}
