import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  assert,
} from 'vitest';
import { ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises } from '@vue/test-utils';
import type { AuthUser } from '@geins/types';
import type { PublicTenantConfig } from '#shared/types/tenant-config';
import { shallowMountComponent } from '../../utils/component';
import CartQuoteRequestButton from '../../../app/components/cart/CartQuoteRequestButton.vue';
import type { CartType } from '../../../shared/types/commerce';
import { useCartStore } from '../../../app/stores/cart';
import { useAuthStore } from '../../../app/stores/auth';
import { useTenant } from '../../../app/composables/useTenant';

// The shared passthrough drops a parameter the key does not spell out; this
// one keeps it, so the request's name shows the date it was given.
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${JSON.stringify(params)}` : key,
    locale: ref('en'),
  }),
}));

// Escapes the tier-wide mock, which answers true for every key; see
// tests/setup-components.ts. The real chain then runs over the fixture below.
vi.unmock('../../../app/composables/useFeatureAccess');

const { tenant } = useTenant();

/** `features` over quote requests switched on, so each case tests its own key. */
function setTenant(
  features: PublicTenantConfig['features'],
  availableLocales = ['sv-SE'],
) {
  assert.isDefined(tenant.value);
  tenant.value.features = { quoteRequests: { enabled: true }, ...features };
  tenant.value.availableLocales = availableLocales;
}

const SIGNED_IN: AuthUser = { userId: '1', username: 'buyer@example.com' };

const CART = {
  id: 'cart-123',
  items: [{ id: 'item-1', skuId: 100, quantity: 2 }],
} as unknown as CartType;

const buttonStub = {
  template:
    '<button v-bind="$attrs" :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
  props: ['disabled', 'variant', 'size'],
  emits: ['click'],
};

function mountButton() {
  return shallowMountComponent(CartQuoteRequestButton, {
    global: { stubs: { Button: buttonStub, UiButton: buttonStub } },
  });
}

const BUTTON = '[data-testid="cart-add-to-quote"]';

describe('CartQuoteRequestButton', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(useRouter().push).mockClear();
    setTenant({ quotes: { enabled: true } });
    useAuthStore().user = SIGNED_IN;
    useCartStore().cart = CART;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-04T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('who sees it', () => {
    it('shows the button and its hint to a signed-in buyer when quotes and quoteRequests are enabled', () => {
      const wrapper = mountButton();

      expect(wrapper.find(BUTTON).text()).toContain('cart.add_to_quote');
      expect(
        wrapper.find('[data-testid="cart-add-to-quote-hint"]').text(),
      ).toBe('cart.add_to_quote_hint');
    });

    it('renders nothing when quotes is disabled', () => {
      setTenant({ quotes: { enabled: false } });

      expect(mountButton().find(BUTTON).exists()).toBe(false);
    });

    it('renders nothing when quoteRequests is disabled', () => {
      setTenant({
        quotes: { enabled: true },
        quoteRequests: { enabled: false },
      });

      expect(mountButton().find(BUTTON).exists()).toBe(false);
    });

    it('renders nothing when quoteRequests is absent from the features', () => {
      assert.isDefined(tenant.value);
      tenant.value.features = { quotes: { enabled: true } };

      expect(mountButton().find(BUTTON).exists()).toBe(false);
    });

    it('renders nothing when quotes is absent from the features', () => {
      setTenant({});

      expect(mountButton().find(BUTTON).exists()).toBe(false);
    });

    it('renders nothing when quotes requires authentication and the user is anonymous', () => {
      setTenant({ quotes: { enabled: true, access: 'authenticated' } });
      useAuthStore().user = null;

      expect(mountButton().find(BUTTON).exists()).toBe(false);
    });

    it('renders nothing to a signed-out buyer even when quotes access is open to all', () => {
      setTenant({ quotes: { enabled: true, access: 'all' } });
      useAuthStore().user = null;

      expect(mountButton().find(BUTTON).exists()).toBe(false);
    });
  });

  describe('the click', () => {
    it('names the request after the cart and the day, in the format of the buyer’s language', async () => {
      setTenant({ quotes: { enabled: true } }, ['en-GB']);
      const store = useCartStore();
      const requestQuote = vi
        .spyOn(store, 'requestQuote')
        .mockResolvedValue('quote-1');

      await mountButton().find(BUTTON).trigger('click');

      expect(requestQuote).toHaveBeenCalledWith(
        'cart.quote_request_name {"date":"4 Nov 2026"}',
      );
    });

    it('opens the quote request page of the new draft', async () => {
      const store = useCartStore();
      vi.spyOn(store, 'requestQuote').mockResolvedValue('quote-1');

      await mountButton().find(BUTTON).trigger('click');
      await flushPromises();

      expect(useRouter().push).toHaveBeenCalledWith(
        '/se/en/portal/quotations/quote-1/request',
      );
    });

    it('stays on the cart and says why when the request fails', async () => {
      const store = useCartStore();
      vi.spyOn(store, 'requestQuote').mockImplementation(async () => {
        store.quoteRequestError = 'cart.add_to_quote_failed';
        return null;
      });

      const wrapper = mountButton();
      await wrapper.find(BUTTON).trigger('click');
      await flushPromises();

      expect(useRouter().push).not.toHaveBeenCalled();
      const error = wrapper.find('[data-testid="cart-add-to-quote-error"]');
      expect(error.text()).toBe('cart.add_to_quote_failed');
      expect(error.attributes('role')).toBe('alert');
    });

    it('shows no error before the buyer has tried', () => {
      expect(
        mountButton().find('[data-testid="cart-add-to-quote-error"]').exists(),
      ).toBe(false);
    });
  });

  describe('when it waits', () => {
    it('is disabled while a configured line is changing', () => {
      useCartStore().updatingItems.add('item-1');

      expect(mountButton().find(BUTTON).attributes('disabled')).toBeDefined();
    });

    it('is disabled while the cart is loading', () => {
      useCartStore().isLoading = true;

      expect(mountButton().find(BUTTON).attributes('disabled')).toBeDefined();
    });

    it('is enabled on a settled cart', () => {
      expect(mountButton().find(BUTTON).attributes('disabled')).toBeUndefined();
    });
  });
});
