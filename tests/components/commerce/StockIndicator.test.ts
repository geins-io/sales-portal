import { describe, it, expect, vi, beforeEach, assert } from 'vitest';
import type { AuthUser } from '@geins/types';
import type { PublicTenantConfig } from '#shared/types/tenant-config';
import { mountComponent } from '../../utils/component';
import StockIndicator from '../../../app/components/shared/StockIndicator.vue';
import { useTenant } from '../../../app/composables/useTenant';
import { useAuthStore } from '../../../app/stores/auth';

// useTenant mock is provided by setup-components.ts — access tenant ref to control features
const { tenant } = useTenant();

// `useTenant()` types `tenant` as nullable because the real composable fills it
// from useFetch. The setup-components mock always provides one, so assert it
// here once instead of reaching for `!` at each site.
function setFeatures(features: PublicTenantConfig['features']) {
  assert.isDefined(tenant.value);
  tenant.value.features = features;
}

// Escapes the tier-wide mock, which answers true for every key; see
// tests/setup-components.ts. The real chain then runs over the fixture below.
vi.unmock('../../../app/composables/useFeatureAccess');

// `isAuthenticated` is `!!user.value`, so identity is all this needs to carry.
const SIGNED_IN: AuthUser = {
  userId: '1',
  username: 'buyer@example.com',
};

function makeStock(overrides: Record<string, number> = {}) {
  return {
    inStock: 100,
    oversellable: 0,
    totalStock: 100,
    static: 0,
    ...overrides,
  };
}

describe('StockIndicator', () => {
  beforeEach(() => {
    setFeatures({});
    // Sign out: the Pinia store is shared across this file's tests.
    useAuthStore().user = null;
  });

  it('renders in-stock state', () => {
    const wrapper = mountComponent(StockIndicator, {
      props: { stock: makeStock() },
    });
    expect(wrapper.text()).toBe('product.in_stock');
  });

  it('renders low-stock state when totalStock <= threshold', () => {
    const wrapper = mountComponent(StockIndicator, {
      props: { stock: makeStock({ totalStock: 3, inStock: 3 }) },
    });
    expect(wrapper.text()).toBe('product.low_stock');
  });

  it('renders low-stock state at the default threshold of 5 and in-stock at 6', () => {
    const at = mountComponent(StockIndicator, {
      props: { stock: makeStock({ totalStock: 5, inStock: 5 }) },
    });
    const above = mountComponent(StockIndicator, {
      props: { stock: makeStock({ totalStock: 6, inStock: 6 }) },
    });
    expect(at.text()).toBe('product.low_stock');
    expect(above.text()).toBe('product.in_stock');
  });

  it('renders out-of-stock state', () => {
    const wrapper = mountComponent(StockIndicator, {
      props: { stock: makeStock({ totalStock: 0, inStock: 0 }) },
    });
    expect(wrapper.text()).toBe('product.out_of_stock');
  });

  it('renders on-demand state when static > 0 and inStock === 0', () => {
    const wrapper = mountComponent(StockIndicator, {
      props: { stock: makeStock({ totalStock: 0, inStock: 0, static: 10 }) },
    });
    expect(wrapper.text()).toBe('product.on_demand');
  });

  it('respects custom threshold', () => {
    const wrapper = mountComponent(StockIndicator, {
      props: {
        stock: makeStock({ totalStock: 8, inStock: 8 }),
        threshold: 10,
      },
    });
    expect(wrapper.text()).toBe('product.low_stock');
  });

  it('renders nothing when stock is undefined', () => {
    const wrapper = mountComponent(StockIndicator, {
      props: { stock: undefined },
    });
    expect(wrapper.text()).toBe('');
    expect(wrapper.find('[data-stock-status]').exists()).toBe(false);
  });

  it('renders a given status over the one the stock gives', () => {
    const wrapper = mountComponent(StockIndicator, {
      props: { stock: makeStock(), status: 'out-of-stock' },
    });
    expect(wrapper.text()).toBe('product.out_of_stock');
  });

  it('renders a given status without stock', () => {
    const wrapper = mountComponent(StockIndicator, {
      props: { status: 'on-demand' },
    });
    expect(wrapper.text()).toBe('product.on_demand');
  });

  it('keeps the dot and the text on one line, the dot hidden from screen readers', () => {
    const wrapper = mountComponent(StockIndicator, {
      props: { stock: makeStock() },
    });
    const root = wrapper.find('[data-stock-status]');
    expect(root.classes()).toEqual(
      expect.arrayContaining([
        'inline-flex',
        'items-center',
        'whitespace-nowrap',
      ]),
    );
    expect(root.find('.rounded-full').attributes('aria-hidden')).toBe('true');
  });

  describe('tone', () => {
    it.each([
      ['in-stock', 'text-success', 'bg-success', makeStock()],
      [
        'low-stock',
        'text-stock-low',
        'bg-stock-low-dot',
        makeStock({ totalStock: 3, inStock: 3 }),
      ],
      [
        'out-of-stock',
        'text-stock-out',
        'bg-stock-out-dot',
        makeStock({ totalStock: 0, inStock: 0 }),
      ],
      [
        'on-demand',
        'text-info',
        'bg-info',
        makeStock({ totalStock: 0, inStock: 0, static: 10 }),
      ],
    ])(
      'renders %s with text %s and a filled %s dot in both sizes',
      (status, text, dot, stock) => {
        for (const size of ['default', 'sm'] as const) {
          const wrapper = mountComponent(StockIndicator, {
            props: { stock, size },
          });
          const root = wrapper.find('[data-stock-status]');
          expect(root.attributes('data-stock-status')).toBe(status);
          expect(root.classes()).toContain(text);
          expect(root.find('.rounded-full').classes()).toContain(dot);
        }
      },
    );
  });

  describe('size', () => {
    it.each([
      ['default', ['gap-2', 'text-sm'], 'size-2.5'],
      ['sm', ['gap-1.5', 'text-xs'], 'size-2'],
    ] as const)('renders the %s size', (size, rootClasses, dotSize) => {
      const wrapper = mountComponent(StockIndicator, {
        props: { stock: makeStock(), size },
      });
      const root = wrapper.find('[data-stock-status]');
      expect(root.classes()).toEqual(expect.arrayContaining([...rootClasses]));
      expect(root.find('.rounded-full').classes()).toContain(dotSize);
    });
  });

  // One test per configured value of `stockStatus`, each writing the value
  // itself rather than a decision derived from it. Registered in
  // tests/unit/config-coverage/map.ts, which requires the key in the title.
  describe('stockStatus', () => {
    function mount() {
      return mountComponent(StockIndicator, {
        props: { stock: makeStock() },
      });
    }

    it('shows the stock indicator when stockStatus is absent from features', () => {
      setFeatures({});
      expect(mount().text()).toContain('product.in_stock');
    });

    it('shows the stock indicator when stockStatus is enabled with no access rule', () => {
      setFeatures({ stockStatus: { enabled: true } });
      expect(mount().text()).toContain('product.in_stock');
    });

    it('hides the stock indicator when stockStatus requires authentication and the user is anonymous', () => {
      setFeatures({ stockStatus: { enabled: true, access: 'authenticated' } });
      expect(mount().text()).toBe('');
    });

    it('shows the stock indicator when stockStatus requires authentication and the user is signed in', () => {
      setFeatures({ stockStatus: { enabled: true, access: 'authenticated' } });
      useAuthStore().user = SIGNED_IN;
      expect(mount().text()).toContain('product.in_stock');
    });

    // Live tenant shape: the seed ships enabled:false alongside an access
    // rule, a combination the admin cannot produce because it hides the access
    // choice when the feature is off. The enabled flag wins regardless.
    it('hides stock when stockStatus is enabled:false with access defined', () => {
      setFeatures({
        stockStatus: { enabled: false, access: 'authenticated' },
      });
      expect(mount().text()).toBe('');
    });
  });
});
