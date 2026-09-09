import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h, Suspense } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { defaultMountOptions } from '../../utils/component';
import { mockIsCatalogMode } from '../../setup-components';

// The page's whole behaviour is one guard in setup: on a catalog tenant it
// redirects to the start page before CartPage is ever reached. Hoisted so the
// global stub and the router module mock share one spy.
const { mockNavigateTo } = vi.hoisted(() => ({
  mockNavigateTo: vi.fn<typeof navigateTo>(() => Promise.resolve()),
}));

vi.stubGlobal('definePageMeta', vi.fn());
vi.stubGlobal('navigateTo', mockNavigateTo);

vi.mock('#app/composables/router', () => ({
  useRoute: () => ({ params: {}, query: {}, path: '/se/en/cart' }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  navigateTo: (...args: Parameters<typeof mockNavigateTo>) =>
    mockNavigateTo(...args),
}));

const { default: CartRoute } = await import('../../../app/pages/cart.vue');

// Top-level await in setup, so the page needs a Suspense boundary.
async function mountCartRoute() {
  const Wrapper = defineComponent({
    setup() {
      return () => h(Suspense, null, { default: () => h(CartRoute) });
    },
  });
  const wrapper = mount(Wrapper, {
    global: {
      ...defaultMountOptions.global,
      stubs: {
        ...defaultMountOptions.global.stubs,
        CartPage: { template: '<div data-testid="cart-page" />' },
      },
    },
  });
  await flushPromises();
  return wrapper;
}

describe('cart route', () => {
  beforeEach(() => {
    mockNavigateTo.mockClear();
  });

  afterEach(() => {
    mockIsCatalogMode.value = false;
  });

  it('redirects to the start page when mode is catalog', async () => {
    mockIsCatalogMode.value = true;

    await mountCartRoute();

    expect(mockNavigateTo).toHaveBeenCalledWith('/se/en/', { replace: true });
  });

  it('renders the cart and does not redirect when mode is commerce', async () => {
    const wrapper = await mountCartRoute();

    expect(mockNavigateTo).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="cart-page"]').exists()).toBe(true);
  });
});
