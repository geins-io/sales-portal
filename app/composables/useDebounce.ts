import { ref, watch, onUnmounted, type Ref } from 'vue';

/**
 * Composable for debounced reactive values
 *
 * Returns a debounced version of the input ref that only updates
 * after the specified delay has passed without changes.
 *
 * @example
 * ```vue
 * <script setup>
 * const searchInput = ref('')
 * const debouncedSearch = useDebounce(searchInput, 300)
 *
 * // debouncedSearch will only update 300ms after searchInput stops changing
 * watch(debouncedSearch, (value) => {
 *   // Perform search API call
 * })
 * </script>
 * ```
 */
export function useDebounce<T>(value: Ref<T>, delay: number = 300): Ref<T> {
  const debouncedValue = ref<T>(value.value) as Ref<T>;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  watch(
    value,
    (newValue) => {
      if (timeout) {
        clearTimeout(timeout);
      }

      timeout = setTimeout(() => {
        debouncedValue.value = newValue;
      }, delay);
    },
    { immediate: false },
  );

  // Cleanup timeout on component unmount to prevent memory leaks
  onUnmounted(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });

  return debouncedValue;
}

/**
 * Composable for debounced function calls
 *
 * Returns a debounced version of the provided function.
 *
 * @example
 * ```vue
 * <script setup>
 * const saveData = async (data: any) => {
 *   await api.save(data)
 * }
 *
 * const { execute, cancel, isPending } = useDebounceFn(saveData, 500)
 *
 * // Call the debounced function
 * execute(myData)
 *
 * // Cancel pending execution
 * cancel()
 * </script>
 * ```
 */
export function useDebounceFn<T extends (...args: Parameters<T>) => unknown>(
  fn: T,
  delay: number = 300,
) {
  const isPending = ref(false);
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const execute = (...args: Parameters<T>) => {
    isPending.value = true;

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      fn(...args);
      isPending.value = false;
    }, delay);
  };

  const cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
      isPending.value = false;
    }
  };

  // Cleanup timeout on component unmount to prevent memory leaks
  onUnmounted(() => {
    cancel();
  });

  return {
    execute,
    cancel,
    isPending,
  };
}

/**
 * Composable for throttled function calls
 *
 * Returns a throttled version of the provided function that can only
 * be called once per specified interval.
 *
 * @example
 * ```vue
 * <script setup>
 * const handleScroll = () => {
 *   console.log('Scroll position:', window.scrollY)
 * }
 *
 * const { execute } = useThrottleFn(handleScroll, 100)
 *
 * // In template: @scroll="execute"
 * </script>
 * ```
 */
export function useThrottleFn<T extends (...args: Parameters<T>) => unknown>(
  fn: T,
  interval: number = 200,
) {
  let lastTime = 0;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const isPending = ref(false);

  const execute = (...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastTime >= interval) {
      lastTime = now;
      fn(...args);
    } else if (!isPending.value) {
      isPending.value = true;
      timeout = setTimeout(
        () => {
          lastTime = Date.now();
          fn(...args);
          isPending.value = false;
        },
        interval - (now - lastTime),
      );
    }
  };

  const cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
      isPending.value = false;
    }
  };

  // Cleanup timeout on component unmount to prevent memory leaks
  onUnmounted(() => {
    cancel();
  });

  return {
    execute,
    cancel,
    isPending,
  };
}
