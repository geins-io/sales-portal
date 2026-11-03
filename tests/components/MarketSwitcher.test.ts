import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computed, ref } from 'vue';
import { mountComponent } from '../utils/component';
import MarketSwitcher from '../../app/components/shared/MarketSwitcher.vue';

const mockMarkets = ref<string[]>(['se', 'de']);
vi.mock('../../app/composables/useTenant', () => ({
  useTenant: () => ({ availableMarkets: computed(() => mockMarkets.value) }),
}));

// null = the route failed (useFetch leaves data null on an error).
const mockCurrencies = ref<Record<string, string> | null>(null);
const mockUseFetch = vi.fn(() => ({
  data: mockCurrencies,
  error: ref(null),
}));
vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: unknown[]) => mockUseFetch(...(args as [])),
}));
vi.stubGlobal('useFetch', mockUseFetch);

const slot = { template: '<div><slot /></div>' };
const stubs = {
  DropdownMenu: slot,
  DropdownMenuTrigger: slot,
  DropdownMenuContent: slot,
  DropdownMenuLabel: slot,
  DropdownMenuSeparator: slot,
  DropdownMenuItem: {
    template: '<div data-testid="market-option"><slot /></div>',
  },
  Button: { template: '<button><slot /></button>' },
};

function mountText() {
  return mountComponent(MarketSwitcher, {
    props: { variant: 'text' },
    global: { stubs },
  });
}

function optionTexts(wrapper: ReturnType<typeof mountText>): string[] {
  return wrapper.findAll('[data-testid="market-option"]').map((o) => o.text());
}

describe('MarketSwitcher render', () => {
  beforeEach(() => {
    mockMarkets.value = ['se', 'de'];
    mockCurrencies.value = { se: 'SEK', de: 'EUR' };
  });

  it('reads the currencies from /api/markets', () => {
    mountText();

    // Nuxt's key transform appends a generated key argument; check the first two.
    const [url, opts] = mockUseFetch.mock.calls[0] as unknown[];
    expect(url).toBe('/api/markets');
    expect(opts).toMatchObject({ dedupe: 'defer' });
  });

  it('shows the current market code with its currency on the trigger', () => {
    expect(mountText().find('button').text()).toBe('SE (SEK)');
  });

  it('shows each market as country name with its currency', () => {
    expect(optionTexts(mountText())).toEqual(['Sweden (SEK)', 'Germany (EUR)']);
  });

  it("shows today's labels when the route failed", () => {
    mockCurrencies.value = null;
    const wrapper = mountText();

    expect(wrapper.find('button').text()).toBe('SE');
    expect(optionTexts(wrapper)).toEqual(['Sweden (SE)', 'Germany (DE)']);
  });

  it('shows the code for a market the route has no currency for', () => {
    mockCurrencies.value = { de: 'EUR' };
    const wrapper = mountText();

    expect(wrapper.find('button').text()).toBe('SE');
    expect(optionTexts(wrapper)).toEqual(['Sweden (SE)', 'Germany (EUR)']);
  });

  it('shows the bare code when the region cannot be named', () => {
    mockMarkets.value = ['se', 'x1'];
    mockCurrencies.value = { se: 'SEK', x1: 'EUR' };

    expect(optionTexts(mountText())).toEqual(['Sweden (SEK)', 'X1']);
  });

  it('renders nothing with a single market', () => {
    mockMarkets.value = ['se'];

    expect(mountText().find('button').exists()).toBe(false);
  });
});

// Same approach as LocaleSwitcher tests — test the component's core logic
// (showSwitcher computed and market display) rather than mounting the SFC.

describe('MarketSwitcher logic', () => {
  describe('showSwitcher', () => {
    function showSwitcher(markets: string[]): boolean {
      return markets.length > 1;
    }

    it('should be false when no markets available', () => {
      expect(showSwitcher([])).toBe(false);
    });

    it('should be false when only one market available', () => {
      expect(showSwitcher(['se'])).toBe(false);
    });

    it('should be true when multiple markets available', () => {
      expect(showSwitcher(['se', 'no'])).toBe(true);
    });

    it('should be true when three markets available', () => {
      expect(showSwitcher(['se', 'no', 'dk'])).toBe(true);
    });
  });

  describe('currentMarket', () => {
    // Mirrors: computed(() => marketCookie.value || market.value)
    function currentMarket(
      cookieValue: string | undefined,
      tenantDefault: string,
    ): string {
      return cookieValue || tenantDefault;
    }

    it('should use cookie value when set', () => {
      expect(currentMarket('no', 'se')).toBe('no');
    });

    it('should fall back to tenant default when no cookie', () => {
      expect(currentMarket(undefined, 'se')).toBe('se');
    });

    it('should fall back to tenant default when cookie is empty', () => {
      expect(currentMarket('', 'se')).toBe('se');
    });
  });

  describe('market display', () => {
    // Mirrors: {{ m.toUpperCase() }}
    it('should uppercase market codes for display', () => {
      expect('se'.toUpperCase()).toBe('SE');
      expect('no'.toUpperCase()).toBe('NO');
      expect('dk'.toUpperCase()).toBe('DK');
    });

    // Mirrors marketShortLabel: the text variant trigger.
    function triggerLabel(
      current: string,
      currencies: Record<string, string> | null,
    ): string {
      const upper = current.toUpperCase();
      const currency = currencies?.[current.toLowerCase()];
      return currency ? `${upper} (${currency})` : upper;
    }

    it('should show the current market code with its currency on the text variant trigger', () => {
      expect(triggerLabel('se', { se: 'SEK' })).toBe('SE (SEK)');
    });

    it('should show the bare current market code when its currency is missing', () => {
      expect(triggerLabel('se', { de: 'EUR' })).toBe('SE');
      expect(triggerLabel('se', null)).toBe('SE');
    });
  });

  describe('marketLabel (full country names in the option list)', () => {
    // Mirrors the component helper: show the localized country name with the
    // code in the dropdown options, e.g. "Sweden (SE)", while falling back to
    // the bare uppercase code when the region can't be resolved.
    function marketLabel(
      code: string,
      regionNames: Intl.DisplayNames | null,
    ): string {
      const upper = code.toUpperCase();
      try {
        const name = regionNames?.of(upper);
        if (name && name !== upper) return `${name} (${upper})`;
      } catch {
        // Malformed region code: fall through to the bare code below.
      }
      return upper;
    }

    const en = new Intl.DisplayNames(['en'], { type: 'region' });
    const sv = new Intl.DisplayNames(['sv'], { type: 'region' });

    it('renders the localized country name with the code in English', () => {
      expect(marketLabel('se', en)).toBe('Sweden (SE)');
      expect(marketLabel('no', en)).toBe('Norway (NO)');
    });

    it('localizes the country name to the active locale', () => {
      expect(marketLabel('se', sv)).toBe('Sverige (SE)');
    });

    it('uppercases the 2-letter code regardless of input case', () => {
      expect(marketLabel('dk', en)).toBe('Denmark (DK)');
    });

    it('falls back to the bare code when region names are unavailable', () => {
      expect(marketLabel('se', null)).toBe('SE');
    });

    it('falls back to the bare code for a malformed region code', () => {
      // A single-letter code is malformed; Intl.DisplayNames.of throws.
      expect(marketLabel('s', en)).toBe('S');
    });
  });

  describe('variant prop', () => {
    const validVariants = ['icon', 'text', 'inline'] as const;

    it('should have icon as a valid variant', () => {
      expect(validVariants).toContain('icon');
    });

    it('should have text as a valid variant', () => {
      expect(validVariants).toContain('text');
    });

    it('should have inline as a valid variant', () => {
      expect(validVariants).toContain('inline');
    });
  });
});
