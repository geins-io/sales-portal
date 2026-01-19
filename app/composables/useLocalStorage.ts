import { ref, watch, onMounted, onUnmounted, type Ref } from 'vue';

/**
 * Composable for reactive localStorage management
 *
 * Provides a reactive reference that syncs with localStorage.
 * Handles SSR by only accessing localStorage on the client.
 *
 * @example
 * ```vue
 * <script setup>
 * const theme = useLocalStorage('theme', 'light')
 * // theme.value is reactive and persisted to localStorage
 * theme.value = 'dark' // Updates localStorage automatically
 * </script>
 * ```
 */
export function useLocalStorage<T>(key: string, defaultValue: T): Ref<T> {
  const storedValue = ref<T>(defaultValue) as Ref<T>;

  // Only access localStorage on the client
  if (import.meta.client) {
    // Initialize with stored value
    const item = localStorage.getItem(key);
    if (item !== null) {
      try {
        storedValue.value = JSON.parse(item);
      } catch {
        // If parsing fails, use the raw string value if T is string
        storedValue.value = item as unknown as T;
      }
    }

    // Watch for changes and persist to localStorage
    watch(
      storedValue,
      (newValue) => {
        if (newValue === null || newValue === undefined) {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, JSON.stringify(newValue));
        }
      },
      { deep: true },
    );

    // Handler for storage events from other tabs
    const storageHandler = (event: StorageEvent) => {
      if (event.key === key && event.newValue !== null) {
        try {
          storedValue.value = JSON.parse(event.newValue);
        } catch {
          storedValue.value = event.newValue as unknown as T;
        }
      }
    };

    // Add listener on mount, remove on unmount to prevent memory leaks
    onMounted(() => {
      window.addEventListener('storage', storageHandler);
    });

    onUnmounted(() => {
      window.removeEventListener('storage', storageHandler);
    });
  }

  return storedValue;
}

/**
 * Composable for reactive sessionStorage management
 *
 * Same as useLocalStorage but uses sessionStorage instead.
 *
 * @example
 * ```vue
 * <script setup>
 * const searchQuery = useSessionStorage('search-query', '')
 * </script>
 * ```
 */
export function useSessionStorage<T>(key: string, defaultValue: T): Ref<T> {
  const storedValue = ref<T>(defaultValue) as Ref<T>;

  // Only access sessionStorage on the client
  if (import.meta.client) {
    // Initialize with stored value
    const item = sessionStorage.getItem(key);
    if (item !== null) {
      try {
        storedValue.value = JSON.parse(item);
      } catch {
        storedValue.value = item as unknown as T;
      }
    }

    // Watch for changes and persist to sessionStorage
    watch(
      storedValue,
      (newValue) => {
        if (newValue === null || newValue === undefined) {
          sessionStorage.removeItem(key);
        } else {
          sessionStorage.setItem(key, JSON.stringify(newValue));
        }
      },
      { deep: true },
    );
  }

  return storedValue;
}

/**
 * Remove an item from localStorage
 */
export function removeFromLocalStorage(key: string): void {
  if (import.meta.client) {
    localStorage.removeItem(key);
  }
}

/**
 * Remove an item from sessionStorage
 */
export function removeFromSessionStorage(key: string): void {
  if (import.meta.client) {
    sessionStorage.removeItem(key);
  }
}

/**
 * Clear all items from localStorage
 */
export function clearLocalStorage(): void {
  if (import.meta.client) {
    localStorage.clear();
  }
}

/**
 * Clear all items from sessionStorage
 */
export function clearSessionStorage(): void {
  if (import.meta.client) {
    sessionStorage.clear();
  }
}
