import { describe, it, expect, vi, beforeEach, assert } from 'vitest';
import type { AuthUser } from '@geins/types';
import type { PublicTenantConfig } from '#shared/types/tenant-config';
import { mountComponent } from '../../utils/component';
import StockBadge from '../../../app/components/shared/StockBadge.vue';
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

const badgeStub = {
  template: '<span class="badge" :class="$attrs.class"><slot /></span>',
  props: ['variant'],
};

const stubs = {
  Badge: badgeStub,
  UiBadge: badgeStub,
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

describe('StockBadge', () => {
  beforeEach(() => {
    setFeatures({});
    // Sign out: the Pinia store is shared across this file's tests.
    useAuthStore().user = null;
  });

  it('renders in-stock state', () => {
    const wrapper = mountComponent(StockBadge, {
      props: { stock: makeStock() },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('product.in_stock');
  });

  it('renders low-stock state when totalStock <= threshold', () => {
    const wrapper = mountComponent(StockBadge, {
      props: { stock: makeStock({ totalStock: 3, inStock: 3 }) },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('product.low_stock');
  });

  it('renders out-of-stock state', () => {
    const wrapper = mountComponent(StockBadge, {
      props: { stock: makeStock({ totalStock: 0, inStock: 0 }) },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('product.out_of_stock');
  });

  it('renders on-demand state when static > 0 and inStock === 0', () => {
    const wrapper = mountComponent(StockBadge, {
      props: { stock: makeStock({ totalStock: 0, inStock: 0, static: 10 }) },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('product.on_demand');
  });

  it('respects custom threshold', () => {
    const wrapper = mountComponent(StockBadge, {
      props: {
        stock: makeStock({ totalStock: 8, inStock: 8 }),
        threshold: 10,
      },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('product.low_stock');
  });

  it('renders nothing when stock is undefined', () => {
    const wrapper = mountComponent(StockBadge, {
      props: { stock: undefined },
      global: { stubs },
    });
    expect(wrapper.text()).toBe('');
  });

  // One test per configured value of `stockStatus`, each writing the value
  // itself rather than a decision derived from it. Registered in
  // tests/unit/config-coverage/map.ts, which requires the key in the title.
  describe('stockStatus', () => {
    function mount() {
      return mountComponent(StockBadge, {
        props: { stock: makeStock() },
        global: { stubs },
      });
    }

    it('shows the stock badge when stockStatus is absent from features', () => {
      setFeatures({});
      expect(mount().text()).toContain('product.in_stock');
    });

    it('shows the stock badge when stockStatus is enabled with no access rule', () => {
      setFeatures({ stockStatus: { enabled: true } });
      expect(mount().text()).toContain('product.in_stock');
    });

    it('hides the stock badge when stockStatus requires authentication and the user is anonymous', () => {
      setFeatures({ stockStatus: { enabled: true, access: 'authenticated' } });
      expect(mount().text()).toBe('');
    });

    it('shows the stock badge when stockStatus requires authentication and the user is signed in', () => {
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
