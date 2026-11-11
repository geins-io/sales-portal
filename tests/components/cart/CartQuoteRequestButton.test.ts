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
import { internalFetch } from '../../../app/utils/internal-fetch';

vi.mock('../../../app/utils/internal-fetch', () => ({
  internalFetch: vi.fn(),
}));

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

const dialogStubs = {
  Dialog: {
    props: ['open'],
    emits: ['update:open'],
    // The dismiss button stands in for Escape and an outside click.
    template:
      '<div v-if="open"><button data-testid="dialog-dismiss" @click="$emit(\'update:open\', false)" /><slot /></div>',
  },
  DialogContent: {
    template: '<div :data-testid="$attrs[\'data-testid\']"><slot /></div>',
  },
  DialogHeader: { template: '<div><slot /></div>' },
  DialogTitle: { template: '<h2 data-testid="dialog-title"><slot /></h2>' },
  DialogDescription: {
    template: '<div data-testid="dialog-text"><slot /></div>',
  },
  DialogFooter: { template: '<div><slot /></div>' },
};

function mountButton() {
  return shallowMountComponent(CartQuoteRequestButton, {
    global: {
      stubs: {
        Button: buttonStub,
        UiButton: buttonStub,
        ...dialogStubs,
      },
    },
  });
}

const BUTTON = '[data-testid="cart-add-to-quote"]';
const DIALOG = '[data-testid="cart-to-quote-dialog"]';
const CONFIRM = '[data-testid="cart-to-quote-confirm"]';
const CANCEL = '[data-testid="cart-to-quote-cancel"]';

/** The buyer's quotations as `/api/quotes` lists them, by name. */
function listQuotes(...names: (string | undefined)[]) {
  vi.mocked(internalFetch).mockResolvedValue({
    quotes: names.map((name, i) => ({ id: `q-${i}`, name })),
    total: names.length,
  });
}

/** Button, then "Continue to checkout" in the dialog. */
async function confirmFromCart(wrapper: ReturnType<typeof mountButton>) {
  await wrapper.find(BUTTON).trigger('click');
  await wrapper.find(CONFIRM).trigger('click');
  await flushPromises();
}

const NAME = (date: string) => `cart.quote_request_name {"date":"${date}"}`;

describe('CartQuoteRequestButton', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(useRouter().push).mockClear();
    vi.mocked(internalFetch).mockReset();
    listQuotes();
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
    it('shows the button, with no hint under it, to a signed-in buyer when quotes and quoteRequests are enabled', () => {
      const wrapper = mountButton();

      expect(wrapper.find(BUTTON).text()).toContain('cart.add_to_quote');
      expect(
        wrapper.find('[data-testid="cart-add-to-quote-hint"]').exists(),
      ).toBe(false);
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

  describe('the dialog', () => {
    it('asks first: the button opens the dialog and creates nothing', async () => {
      const requestQuote = vi.spyOn(useCartStore(), 'requestQuote');
      const wrapper = mountButton();
      expect(wrapper.find(DIALOG).exists()).toBe(false);

      await wrapper.find(BUTTON).trigger('click');

      const dialog = wrapper.find(DIALOG);
      expect({
        title: dialog.find('[data-testid="dialog-title"]').text(),
        text: dialog
          .findAll('[data-testid="dialog-text"] p')
          .map((p) => p.text()),
        cancel: dialog.find(CANCEL).text(),
        confirm: dialog.find(CONFIRM).text(),
      }).toEqual({
        title: 'cart.quote_confirm_title',
        text: ['cart.quote_confirm_text', 'cart.quote_confirm_draft'],
        cancel: 'common.cancel',
        confirm: 'cart.quote_confirm_submit',
      });
      expect(requestQuote).not.toHaveBeenCalled();
    });

    it('reads the buyer’s quotations when the dialog opens, not before', async () => {
      const wrapper = mountButton();
      expect(internalFetch).not.toHaveBeenCalled();

      await wrapper.find(BUTTON).trigger('click');

      expect(internalFetch).toHaveBeenCalledWith('/api/quotes');
    });

    it('cancel closes the dialog and leaves the cart as it was', async () => {
      const store = useCartStore();
      const requestQuote = vi.spyOn(store, 'requestQuote');
      const wrapper = mountButton();

      await wrapper.find(BUTTON).trigger('click');
      await wrapper.find(CANCEL).trigger('click');
      await flushPromises();

      expect(wrapper.find(DIALOG).exists()).toBe(false);
      expect(requestQuote).not.toHaveBeenCalled();
      expect(store.cart).toEqual(CART);
      expect(useRouter().push).not.toHaveBeenCalled();
    });
  });

  describe('continue', () => {
    it('names the request after the cart and the day, in the format of the buyer’s language', async () => {
      setTenant({ quotes: { enabled: true } }, ['en-GB']);
      const requestQuote = vi
        .spyOn(useCartStore(), 'requestQuote')
        .mockResolvedValue('quote-1');

      await confirmFromCart(mountButton());

      expect(requestQuote).toHaveBeenCalledWith(NAME('4 Nov 2026'));
    });

    it('opens the quote request page of the new draft', async () => {
      vi.spyOn(useCartStore(), 'requestQuote').mockResolvedValue('quote-1');

      await confirmFromCart(mountButton());

      expect(useRouter().push).toHaveBeenCalledWith(
        '/se/en/portal/quotations/quote-1/request',
      );
    });

    it('holds the confirm button while the request is made', async () => {
      let settle: (id: string | null) => void = () => {};
      vi.spyOn(useCartStore(), 'requestQuote').mockReturnValue(
        new Promise((resolve) => (settle = resolve)),
      );
      const wrapper = mountButton();

      await confirmFromCart(wrapper);
      expect(wrapper.find(CONFIRM).attributes('disabled')).toBeDefined();

      settle('quote-1');
      await flushPromises();
      expect(useRouter().push).toHaveBeenCalled();
    });

    it('cannot be cancelled or dismissed while the request is made', async () => {
      let settle: (id: string | null) => void = () => {};
      vi.spyOn(useCartStore(), 'requestQuote').mockReturnValue(
        new Promise((resolve) => (settle = resolve)),
      );
      const wrapper = mountButton();

      await confirmFromCart(wrapper);
      expect(wrapper.find(CANCEL).attributes('disabled')).toBeDefined();
      await wrapper.find('[data-testid="dialog-dismiss"]').trigger('click');
      expect(wrapper.find(DIALOG).exists()).toBe(true);

      settle('quote-1');
      await flushPromises();
    });

    it('can be dismissed before the buyer confirms', async () => {
      const wrapper = mountButton();
      await wrapper.find(BUTTON).trigger('click');
      expect(wrapper.find(CANCEL).attributes('disabled')).toBeUndefined();

      await wrapper.find('[data-testid="dialog-dismiss"]').trigger('click');

      expect(wrapper.find(DIALOG).exists()).toBe(false);
    });

    it('closes the dialog and says why when the request fails, staying on the cart', async () => {
      const store = useCartStore();
      vi.spyOn(store, 'requestQuote').mockImplementation(async () => {
        store.quoteRequestError = 'cart.add_to_quote_failed';
        return null;
      });

      const wrapper = mountButton();
      await confirmFromCart(wrapper);

      expect(useRouter().push).not.toHaveBeenCalled();
      expect(wrapper.find(DIALOG).exists()).toBe(false);
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

  describe('the draft name', () => {
    const TODAY = NAME('4 Nov 2026');

    beforeEach(() => {
      setTenant({ quotes: { enabled: true } }, ['en-GB']);
    });

    function nameSent() {
      const requestQuote = vi
        .spyOn(useCartStore(), 'requestQuote')
        .mockResolvedValue('quote-1');
      return async () => {
        await confirmFromCart(mountButton());
        return requestQuote.mock.calls[0]?.[0];
      };
    }

    it('is the plain name when no quotation has it', async () => {
      listQuotes('Something else', undefined);

      expect(await nameSent()()).toBe(TODAY);
    });

    it('gets (2) when the plain name is taken', async () => {
      listQuotes(TODAY);

      expect(await nameSent()()).toBe(`${TODAY} (2)`);
    });

    it('gets (3) when the plain name and (2) are taken', async () => {
      listQuotes(`${TODAY} (2)`, TODAY);

      expect(await nameSent()()).toBe(`${TODAY} (3)`);
    });

    it('takes the first free number, filling a gap', async () => {
      listQuotes(TODAY, `${TODAY} (3)`);

      expect(await nameSent()()).toBe(`${TODAY} (2)`);
    });

    it('falls back to the plain name when the quotations cannot be read', async () => {
      vi.mocked(internalFetch).mockRejectedValue(new Error('500'));

      expect(await nameSent()()).toBe(TODAY);
    });

    it('reads the quotations again each time the dialog opens', async () => {
      const requestQuote = vi
        .spyOn(useCartStore(), 'requestQuote')
        .mockResolvedValue('quote-1');
      const wrapper = mountButton();
      await wrapper.find(BUTTON).trigger('click');
      await wrapper.find(CANCEL).trigger('click');
      listQuotes(TODAY);

      await confirmFromCart(wrapper);

      expect(internalFetch).toHaveBeenCalledTimes(2);
      expect(requestQuote).toHaveBeenCalledWith(`${TODAY} (2)`);
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
