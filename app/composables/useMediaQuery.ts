import { ref, onMounted, onUnmounted, computed } from 'vue';
import { BREAKPOINTS } from '#shared/constants';

/**
 * Composable for reactive media query matching
 *
 * Returns an `isHydrated` flag to help avoid SSR hydration mismatches.
 * The `matches` ref is always `false` during SSR. After hydration (client-side),
 * `isHydrated` becomes `true` and `matches` reflects the actual media query state.
 *
 * @example
 * ```vue
 * <script setup>
 * const { matches, isHydrated } = useMediaQuery('(min-width: 768px)')
 *
 * // Use isHydrated to conditionally render client-specific content
 * // to avoid hydration mismatches
 * </script>
 *
 * <template>
 *   <div v-if="isHydrated && matches">Wide screen content</div>
 *   <div v-else>Default/narrow screen content</div>
 * </template>
 * ```
 *
 * @example
 * ```vue
 * <script setup>
 * // Or use the predefined breakpoint helpers
 * const { isMd, isLg, isMobile, isDesktop, isHydrated } = useBreakpoints()
 * </script>
 * ```
 */
export function useMediaQuery(query: string) {
  const matches = ref(false);
  const isHydrated = ref(false);
  let mediaQuery: MediaQueryList | null = null;

  const handler = (event: MediaQueryListEvent) => {
    matches.value = event.matches;
  };

  onMounted(() => {
    if (typeof window !== 'undefined') {
      mediaQuery = window.matchMedia(query);
      matches.value = mediaQuery.matches;
      mediaQuery.addEventListener('change', handler);
      isHydrated.value = true;
    }
  });

  onUnmounted(() => {
    if (mediaQuery) {
      mediaQuery.removeEventListener('change', handler);
    }
  });

  return {
    matches,
    isHydrated,
  };
}

/**
 * Debounce utility for internal use
 * Creates a debounced version of a function that delays execution
 */
function createDebouncedFn<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): { execute: (...args: Parameters<T>) => void; cancel: () => void } {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const execute = (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      fn(...args);
    }, delay);
  };

  const cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return { execute, cancel };
}

/**
 * Composable for common responsive breakpoints
 *
 * Uses Tailwind CSS default breakpoints.
 * Returns an `isHydrated` flag to help avoid SSR hydration mismatches.
 *
 * Optimized to use a single resize listener with debouncing instead of
 * multiple MediaQueryList listeners for better performance.
 *
 * @example
 * ```vue
 * <script setup>
 * const { isMobile, isTablet, isDesktop, currentBreakpoint, isHydrated } = useBreakpoints()
 * </script>
 *
 * <template>
 *   <!-- Use isHydrated to conditionally render responsive content -->
 *   <div v-if="!isHydrated">Loading...</div>
 *   <div v-else-if="isMobile">Mobile view</div>
 *   <div v-else-if="isTablet">Tablet view</div>
 *   <div v-else>Desktop view</div>
 * </template>
 * ```
 */
export function useBreakpoints() {
  // Screen dimensions - the single source of truth
  const width = ref(0);
  const height = ref(0);
  const isHydrated = ref(false);

  // Single resize listener with debouncing
  onMounted(() => {
    if (typeof window !== 'undefined') {
      const updateDimensions = () => {
        width.value = window.innerWidth;
        height.value = window.innerHeight;
      };

      // Create debounced version for resize events
      const { execute: debouncedUpdate, cancel } = createDebouncedFn(
        updateDimensions,
        100,
      );

      // Set initial dimensions immediately (no debounce)
      updateDimensions();
      isHydrated.value = true;

      window.addEventListener('resize', debouncedUpdate);

      onUnmounted(() => {
        window.removeEventListener('resize', debouncedUpdate);
        cancel();
      });
    }
  });

  // Computed breakpoint flags based on width
  const isSm = computed(() => width.value >= BREAKPOINTS.SM);
  const isMd = computed(() => width.value >= BREAKPOINTS.MD);
  const isLg = computed(() => width.value >= BREAKPOINTS.LG);
  const isXl = computed(() => width.value >= BREAKPOINTS.XL);
  const is2Xl = computed(() => width.value >= BREAKPOINTS['2XL']);

  // Semantic helpers
  const isMobile = computed(() => !isSm.value);
  const isTablet = computed(() => isSm.value && !isLg.value);
  const isDesktop = computed(() => isLg.value);

  // Current breakpoint name
  const currentBreakpoint = computed(() => {
    if (is2Xl.value) return '2xl';
    if (isXl.value) return 'xl';
    if (isLg.value) return 'lg';
    if (isMd.value) return 'md';
    if (isSm.value) return 'sm';
    return 'xs';
  });

  return {
    // Hydration state
    isHydrated,
    // Breakpoint flags
    isSm,
    isMd,
    isLg,
    isXl,
    is2Xl,
    // Semantic helpers
    isMobile,
    isTablet,
    isDesktop,
    // Current breakpoint
    currentBreakpoint,
    // Screen dimensions
    width,
    height,
  };
}

/**
 * Composable for reduced motion preference
 *
 * Use this to respect users who prefer reduced motion.
 * Returns an `isHydrated` flag to help avoid SSR hydration mismatches.
 *
 * @example
 * ```vue
 * <script setup>
 * const { prefersReducedMotion, isHydrated } = useReducedMotion()
 * </script>
 *
 * <template>
 *   <div :class="{ 'animate-bounce': isHydrated && !prefersReducedMotion }">
 *     Bouncing element (unless reduced motion is preferred)
 *   </div>
 * </template>
 * ```
 */
export function useReducedMotion() {
  const { matches: prefersReducedMotion, isHydrated } = useMediaQuery(
    '(prefers-reduced-motion: reduce)',
  );

  return {
    prefersReducedMotion,
    isHydrated,
  };
}
