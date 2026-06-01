import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';

// Cookie ref that the mock useCookie returns
const mockCookieValue = ref<'inc' | 'ex' | undefined>(undefined);

// Mock the Nuxt cookie composable
vi.mock('#app/composables/cookie', () => ({
  useCookie: () => mockCookieValue,
}));

// Mock the shared constants so the module loads without path issues
vi.mock('#shared/constants/storage', () => ({
  COOKIE_NAMES: {
    VAT_DISPLAY: 'vat_display',
  },
}));

// Stub Nuxt auto-imports as globals (matches useLocaleMarket.test.ts pattern)
vi.stubGlobal('useCookie', () => mockCookieValue);
vi.stubGlobal('computed', computed);

describe('useVatDisplay', () => {
  let useVatDisplay: typeof import('../../../app/composables/useVatDisplay').useVatDisplay;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockCookieValue.value = undefined;

    // Re-stub after resetModules
    vi.stubGlobal('useCookie', () => mockCookieValue);
    vi.stubGlobal('computed', computed);

    const mod = await import('../../../app/composables/useVatDisplay');
    useVatDisplay = mod.useVatDisplay;
  });

  describe('showIncVat', () => {
    it('returns true when cookie is undefined (default incl-VAT)', () => {
      mockCookieValue.value = undefined;
      const { showIncVat } = useVatDisplay();
      expect(showIncVat.value).toBe(true);
    });

    it('returns true when cookie value is "inc"', () => {
      mockCookieValue.value = 'inc';
      const { showIncVat } = useVatDisplay();
      expect(showIncVat.value).toBe(true);
    });

    it('returns false when cookie value is "ex"', () => {
      mockCookieValue.value = 'ex';
      const { showIncVat } = useVatDisplay();
      expect(showIncVat.value).toBe(false);
    });
  });

  describe('setShowIncVat', () => {
    it('writes "ex" to cookie and sets showIncVat to false', () => {
      mockCookieValue.value = 'inc';
      const { showIncVat, setShowIncVat } = useVatDisplay();
      setShowIncVat(false);
      expect(mockCookieValue.value).toBe('ex');
      expect(showIncVat.value).toBe(false);
    });

    it('writes "inc" to cookie and sets showIncVat to true', () => {
      mockCookieValue.value = 'ex';
      const { showIncVat, setShowIncVat } = useVatDisplay();
      setShowIncVat(true);
      expect(mockCookieValue.value).toBe('inc');
      expect(showIncVat.value).toBe(true);
    });
  });

  describe('toggle', () => {
    it('flips from inc to ex', () => {
      mockCookieValue.value = 'inc';
      const { showIncVat, toggle } = useVatDisplay();
      toggle();
      expect(mockCookieValue.value).toBe('ex');
      expect(showIncVat.value).toBe(false);
    });

    it('flips from ex to inc', () => {
      mockCookieValue.value = 'ex';
      const { showIncVat, toggle } = useVatDisplay();
      toggle();
      expect(mockCookieValue.value).toBe('inc');
      expect(showIncVat.value).toBe(true);
    });
  });
});
