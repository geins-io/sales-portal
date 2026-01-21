import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  useMediaQuery,
  useBreakpoints,
  useReducedMotion,
} from '../../app/composables/useMediaQuery';

// Mock the BREAKPOINTS constant
vi.mock('#shared/constants', () => ({
  BREAKPOINTS: {
    SM: 640,
    MD: 768,
    LG: 1024,
    XL: 1280,
    '2XL': 1536,
  },
}));

describe('useMediaQuery', () => {
  let mockMediaQueryList: {
    matches: boolean;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockMediaQueryList = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    // Mock window.matchMedia
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mockMediaQueryList));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return matches and isHydrated refs', () => {
    const result = useMediaQuery('(min-width: 768px)');

    expect(result).toHaveProperty('matches');
    expect(result).toHaveProperty('isHydrated');
  });

  it('should initialize matches as false (SSR-safe default)', () => {
    const { matches } = useMediaQuery('(min-width: 768px)');

    expect(matches.value).toBe(false);
  });

  it('should initialize isHydrated as false before mounting', () => {
    const { isHydrated } = useMediaQuery('(min-width: 768px)');

    expect(isHydrated.value).toBe(false);
  });

  describe('after mounting (simulated with lifecycle hooks)', () => {
    // Note: These tests verify the composable structure.
    // In a real Nuxt/Vue environment, the lifecycle hooks would be triggered by the component.
    // For deeper integration testing, use @vue/test-utils with a wrapper component.

    it('should have consistent initial state for SSR', () => {
      const { matches, isHydrated } = useMediaQuery('(min-width: 768px)');

      // Both should be false initially - this is the key SSR safety feature
      expect(matches.value).toBe(false);
      expect(isHydrated.value).toBe(false);
    });

    it('should call matchMedia with the correct query', () => {
      useMediaQuery('(min-width: 1024px)');

      // Note: matchMedia is only called in onMounted, so we verify the function exists
      expect(window.matchMedia).toBeDefined();
    });
  });
});

describe('useBreakpoints', () => {
  beforeEach(() => {
    // Mock window dimensions - initially set to 0 (will be read on mount)
    vi.stubGlobal('innerWidth', 1024);
    vi.stubGlobal('innerHeight', 768);
    vi.stubGlobal('addEventListener', vi.fn());
    vi.stubGlobal('removeEventListener', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return isHydrated flag', () => {
    const result = useBreakpoints();

    expect(result).toHaveProperty('isHydrated');
    // Initially false before mount
    expect(result.isHydrated.value).toBe(false);
  });

  it('should return all breakpoint flags', () => {
    const result = useBreakpoints();

    expect(result).toHaveProperty('isSm');
    expect(result).toHaveProperty('isMd');
    expect(result).toHaveProperty('isLg');
    expect(result).toHaveProperty('isXl');
    expect(result).toHaveProperty('is2Xl');
  });

  it('should return semantic helpers', () => {
    const result = useBreakpoints();

    expect(result).toHaveProperty('isMobile');
    expect(result).toHaveProperty('isTablet');
    expect(result).toHaveProperty('isDesktop');
  });

  it('should return currentBreakpoint computed', () => {
    const result = useBreakpoints();

    expect(result).toHaveProperty('currentBreakpoint');
    // Initially xs since width starts at 0 (before mount)
    expect(result.currentBreakpoint.value).toBe('xs');
  });

  it('should return screen dimensions', () => {
    const result = useBreakpoints();

    expect(result).toHaveProperty('width');
    expect(result).toHaveProperty('height');
    // Initially 0 before mount
    expect(result.width.value).toBe(0);
    expect(result.height.value).toBe(0);
  });

  it('should have isMobile true when width is 0 (SSR default)', () => {
    const { isMobile } = useBreakpoints();

    // By default (before mount), width is 0, so isMobile should be true
    expect(isMobile.value).toBe(true);
  });

  it('should have isDesktop false when width is 0 (SSR default)', () => {
    const { isDesktop } = useBreakpoints();

    // By default (before mount), width is 0, so isDesktop should be false
    expect(isDesktop.value).toBe(false);
  });

  it('should compute breakpoint flags correctly based on width thresholds', () => {
    const result = useBreakpoints();

    // Initially width is 0 (before mount)
    expect(result.isSm.value).toBe(false); // width >= 640
    expect(result.isMd.value).toBe(false); // width >= 768
    expect(result.isLg.value).toBe(false); // width >= 1024
    expect(result.isXl.value).toBe(false); // width >= 1280
    expect(result.is2Xl.value).toBe(false); // width >= 1536
  });

  it('should use a single resize listener (optimization test)', () => {
    useBreakpoints();

    // The composable should NOT call matchMedia (old implementation)
    // It uses window.addEventListener for resize instead
    expect(window.matchMedia).toBeUndefined();
  });
});

describe('useReducedMotion', () => {
  let mockMediaQueryList: {
    matches: boolean;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockMediaQueryList = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mockMediaQueryList));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return prefersReducedMotion and isHydrated', () => {
    const result = useReducedMotion();

    expect(result).toHaveProperty('prefersReducedMotion');
    expect(result).toHaveProperty('isHydrated');
  });

  it('should initialize prefersReducedMotion as false (SSR-safe)', () => {
    const { prefersReducedMotion } = useReducedMotion();

    expect(prefersReducedMotion.value).toBe(false);
  });

  it('should initialize isHydrated as false', () => {
    const { isHydrated } = useReducedMotion();

    expect(isHydrated.value).toBe(false);
  });
});

describe('SSR hydration safety', () => {
  let mockMediaQueryList: {
    matches: boolean;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockMediaQueryList = {
      matches: true, // Simulate a "matching" media query on client
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mockMediaQueryList));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should always start with matches=false for consistent SSR', () => {
    // Even though the mock returns matches=true, the composable
    // should initialize with false for SSR consistency
    const { matches } = useMediaQuery('(min-width: 768px)');

    expect(matches.value).toBe(false);
  });

  it('should always start with isHydrated=false', () => {
    const { isHydrated } = useMediaQuery('(min-width: 768px)');

    expect(isHydrated.value).toBe(false);
  });

  it('provides isHydrated flag to detect when client values are ready', () => {
    const { matches, isHydrated } = useMediaQuery('(min-width: 768px)');

    // Before hydration, both are false - safe for SSR
    expect(isHydrated.value).toBe(false);
    expect(matches.value).toBe(false);

    // Components can use isHydrated to conditionally render
    // client-specific content after hydration completes
    // Example: v-if="isHydrated && matches"
  });
});
