// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, assert } from 'vitest';
import { ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises } from '@vue/test-utils';
import type { AuthUser } from '@geins/types';
import type { PublicTenantConfig } from '#shared/types/tenant-config';
import type { QuoteListItem } from '#shared/types/quote';
import { mountComponent } from '../../utils/component';
import ProductAddToQuote from '../../../app/components/product/ProductAddToQuote.vue';
import { useAuthStore } from '../../../app/stores/auth';
import { useTenant } from '../../../app/composables/useTenant';
import { internalFetch } from '../../../app/utils/internal-fetch';

vi.mock('../../../app/utils/internal-fetch', () => ({
  internalFetch: vi.fn(),
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: unknown) =>
      params === undefined ? key : `${key} ${JSON.stringify(params)}`,
    locale: ref('sv'),
  }),
}));

// The real access chain over the tenant below; see tests/setup-components.ts.
vi.unmock('../../../app/composables/useFeatureAccess');

const { tenant } = useTenant();

function setFeatures(features: PublicTenantConfig['features']) {
  assert.isDefined(tenant.value);
  tenant.value.features = features;
}

const SIGNED_IN: AuthUser = { userId: '1', username: 'buyer@example.com' };

function listed(
  id: string,
  status: QuoteListItem['status'],
  updatedAt: string,
  itemCount = 1,
): Partial<QuoteListItem> {
  return { id, name: `Draft ${id}`, status, updatedAt, itemCount };
}

function buyerHas(...quotes: Partial<QuoteListItem>[]) {
  vi.mocked(internalFetch).mockResolvedValue({
    quotes,
    total: quotes.length,
  });
}

const stubs = {
  DropdownMenu: {
    props: ['open'],
    emits: ['update:open'],
    template:
      '<div><div data-testid="menu-open" @click="$emit(\'update:open\', true)" /><slot /></div>',
  },
  DropdownMenuTrigger: { template: '<div><slot /></div>' },
  DropdownMenuContent: {
    template: '<div :data-testid="$attrs[\'data-testid\']"><slot /></div>',
  },
  DropdownMenuLabel: { template: '<p data-testid="menu-label"><slot /></p>' },
  DropdownMenuSeparator: { template: '<hr />' },
  DropdownMenuItem: {
    props: ['disabled'],
    emits: ['select'],
    template:
      '<button v-bind="$attrs" :disabled="disabled" @click="$emit(\'select\', $event)"><slot /></button>',
  },
  Dialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
  DialogContent: {
    template: '<div :data-testid="$attrs[\'data-testid\']"><slot /></div>',
  },
  DialogHeader: { template: '<div><slot /></div>' },
  DialogTitle: { template: '<h2 data-testid="dialog-title"><slot /></h2>' },
  DialogDescription: { template: '<p><slot /></p>' },
  DialogFooter: { template: '<div><slot /></div>' },
};

const QUOTE = { id: 'draft-9', name: 'Etapp 2' };

function mount(props: Record<string, unknown> = {}) {
  return mountComponent(ProductAddToQuote, {
    props: { send: vi.fn().mockResolvedValue(QUOTE), ...props },
    global: { stubs },
  });
}

const BUTTON = '[data-testid="add-to-quote-button"]';
const DRAFT = '[data-testid="add-to-quote-draft"]';
const NEW = '[data-testid="add-to-quote-new"]';
const NOTICE = '[data-testid="add-to-quote-confirmation"]';
const ERROR = '[data-testid="add-to-quote-error"]';

async function openMenu(wrapper: ReturnType<typeof mount>) {
  await wrapper.find('[data-testid="menu-open"]').trigger('click');
  await flushPromises();
}

describe('ProductAddToQuote', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(internalFetch).mockReset();
    buyerHas();
    setFeatures({
      quotes: { enabled: true },
      quoteRequests: { enabled: true },
    });
    useAuthStore().user = SIGNED_IN;
  });

  describe('who sees it', () => {
    it('shows the button to a signed-in buyer when quotes and quoteRequests are enabled', () => {
      expect(mount().find(BUTTON).text()).toContain('product.add_to_quote');
    });

    it.each([
      [
        'quoteRequests is disabled',
        { quotes: { enabled: true }, quoteRequests: { enabled: false } },
      ],
      ['quoteRequests is absent', { quotes: { enabled: true } }],
      [
        'quotes is disabled',
        { quotes: { enabled: false }, quoteRequests: { enabled: true } },
      ],
    ])('renders nothing when %s', (_case, features) => {
      setFeatures(features as PublicTenantConfig['features']);

      expect(mount().find(BUTTON).exists()).toBe(false);
    });

    it('renders nothing to a signed-out buyer, even where quotes are open to all', () => {
      setFeatures({
        quotes: { enabled: true, access: 'all' },
        quoteRequests: { enabled: true },
      });
      useAuthStore().user = null;

      expect(mount().find(BUTTON).exists()).toBe(false);
    });
  });

  describe('the menu', () => {
    it("lists only the buyer's drafts, most recently changed first, each with its item count", async () => {
      buyerHas(
        listed('a', 'request_draft', '2026-11-10T08:00:00Z', 1),
        listed('b', 'pending', '2026-11-12T08:00:00Z'),
        listed('c', 'request_draft', '2026-11-12T09:00:00Z', 4),
        listed('d', 'requested', '2026-11-12T10:00:00Z'),
      );
      const wrapper = mount();

      await openMenu(wrapper);

      expect(wrapper.find('[data-testid="menu-label"]').text()).toBe(
        'product.quote_menu.label',
      );
      expect(
        wrapper
          .findAll(DRAFT)
          .map((row) => row.findAll('span').map((part) => part.text())),
      ).toEqual([
        ['Draft c', 'product.quote_menu.items {"count":4}'],
        ['Draft a', 'product.quote_menu.items {"count":1}'],
      ]);
      expect(wrapper.find(NEW).text()).toContain(
        'product.quote_menu.new_request',
      );
    });

    it('says the buyer has no drafts, and still offers a new one', async () => {
      buyerHas(listed('b', 'pending', '2026-11-12T08:00:00Z'));
      const wrapper = mount();

      await openMenu(wrapper);

      expect(wrapper.findAll(DRAFT)).toHaveLength(0);
      expect(wrapper.find('[data-testid="add-to-quote-empty"]').text()).toBe(
        'product.quote_menu.no_drafts',
      );
      expect(wrapper.find(NEW).exists()).toBe(true);
    });

    it('reads the drafts again each time it opens', async () => {
      const wrapper = mount();

      await openMenu(wrapper);
      await openMenu(wrapper);

      expect(internalFetch).toHaveBeenCalledTimes(2);
      expect(internalFetch).toHaveBeenCalledWith('/api/quotes');
    });

    it('says when the drafts could not be read, and still offers a new one', async () => {
      vi.mocked(internalFetch).mockRejectedValue(new Error('down'));
      const wrapper = mount();

      await openMenu(wrapper);

      expect(
        wrapper.find('[data-testid="add-to-quote-load-failed"]').text(),
      ).toBe('product.quote_menu.load_failed');
      expect(wrapper.find(NEW).exists()).toBe(true);
    });
  });

  describe('adding to a draft', () => {
    it('sends the picked draft and says where the product landed, with a link to it', async () => {
      buyerHas(listed('a', 'request_draft', '2026-11-10T08:00:00Z'));
      const send = vi.fn().mockResolvedValue({ id: 'a', name: 'Draft a' });
      const wrapper = mount({ send });
      await openMenu(wrapper);

      await wrapper.find(DRAFT).trigger('click');
      await flushPromises();

      expect(send).toHaveBeenCalledWith({ quoteId: 'a' });
      const notice = wrapper.find(NOTICE);
      expect(notice.text()).toContain('product.quote_menu.added');
      expect(notice.text()).toContain('Draft a');
      expect(notice.text()).not.toContain('added_new');
      expect(
        wrapper.find('[data-testid="add-to-quote-view"]').attributes('href'),
      ).toMatch(/\/portal\/quotations\/a$/);
    });

    it('shows an error and no notice when the add fails', async () => {
      buyerHas(listed('a', 'request_draft', '2026-11-10T08:00:00Z'));
      const send = vi.fn().mockRejectedValue(new Error('not added'));
      const wrapper = mount({ send });
      await openMenu(wrapper);

      await wrapper.find(DRAFT).trigger('click');
      await flushPromises();

      expect(wrapper.find(NOTICE).exists()).toBe(false);
      expect(wrapper.find(ERROR).text()).toBe('product.quote_menu.failed');
    });

    it('drops an earlier notice when a later add fails', async () => {
      buyerHas(listed('a', 'request_draft', '2026-11-10T08:00:00Z'));
      const send = vi
        .fn()
        .mockResolvedValueOnce({ id: 'a', name: 'Draft a' })
        .mockRejectedValueOnce(new Error('not added'));
      const wrapper = mount({ send });

      await openMenu(wrapper);
      await wrapper.find(DRAFT).trigger('click');
      await flushPromises();
      await openMenu(wrapper);
      await wrapper.find(DRAFT).trigger('click');
      await flushPromises();

      expect(wrapper.find(NOTICE).exists()).toBe(false);
      expect(wrapper.find(ERROR).exists()).toBe(true);
    });

    it('sends one add at a time: the button waits while one runs', async () => {
      buyerHas(listed('a', 'request_draft', '2026-11-10T08:00:00Z'));
      let finish: (value: unknown) => void = () => {};
      const send = vi.fn(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      const wrapper = mount({ send });
      await openMenu(wrapper);

      await wrapper.find(DRAFT).trigger('click');
      await wrapper.find(DRAFT).trigger('click');

      expect(send).toHaveBeenCalledOnce();
      expect(wrapper.find(BUTTON).attributes()).toHaveProperty('disabled');
      finish({ id: 'a', name: 'Draft a' });
      await flushPromises();
      expect(wrapper.find(BUTTON).attributes()).not.toHaveProperty('disabled');
    });
  });

  describe('a new request', () => {
    it('asks for a name in the name dialog, then sends it and says a new draft was made', async () => {
      const send = vi
        .fn()
        .mockResolvedValue({ id: 'draft-9', name: 'Etapp 2' });
      const wrapper = mount({ send });
      await openMenu(wrapper);

      await wrapper.find(NEW).trigger('click');
      expect(wrapper.find('[data-testid="dialog-title"]').text()).toBe(
        'portal.quotations.rename_dialog.new_title',
      );
      await wrapper
        .find('[data-testid="rename-draft-input"]')
        .setValue('  Etapp 2 ');
      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(send).toHaveBeenCalledWith({ name: 'Etapp 2' });
      expect(wrapper.find('[data-testid="rename-draft-dialog"]').exists()).toBe(
        false,
      );
      expect(wrapper.find(NOTICE).text()).toContain(
        'product.quote_menu.added_new',
      );
      expect(wrapper.find(NOTICE).text()).toContain('Etapp 2');
    });

    it('keeps the dialog open with the error when the new draft fails', async () => {
      const send = vi.fn().mockRejectedValue(new Error('no draft'));
      const wrapper = mount({ send });
      await openMenu(wrapper);
      await wrapper.find(NEW).trigger('click');
      await wrapper.find('[data-testid="rename-draft-input"]').setValue('X');

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(wrapper.find('[data-testid="rename-draft-dialog"]').exists()).toBe(
        true,
      );
      expect(wrapper.find('[data-testid="rename-draft-failed"]').text()).toBe(
        'product.quote_menu.failed',
      );
      expect(wrapper.find(ERROR).exists()).toBe(false);
      expect(wrapper.find(NOTICE).exists()).toBe(false);
    });
  });

  describe('a menu the page takes off and puts back', () => {
    beforeEach(() => {
      buyerHas(listed('a', 'request_draft', '2026-11-10T08:00:00Z'));
    });

    async function addFrom(wrapper: ReturnType<typeof mount>) {
      await openMenu(wrapper);
      await wrapper.find(DRAFT).trigger('click');
    }

    it('shows the notice again when mounted again for the same page', async () => {
      const send = vi.fn().mockResolvedValue({ id: 'a', name: 'Draft a' });
      const first = mount({ send, scope: 'page-1' });
      await addFrom(first);
      await flushPromises();
      first.unmount();

      const again = mount({ send, scope: 'page-1' });

      expect(again.find(NOTICE).text()).toContain('Draft a');
    });

    it('shows an add that answered while the menu was off the page', async () => {
      let finish: (value: unknown) => void = () => {};
      const send = vi.fn(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      const first = mount({ send, scope: 'page-1' });
      await addFrom(first);
      first.unmount();
      finish({ id: 'a', name: 'Draft a' });
      await flushPromises();

      const again = mount({ send, scope: 'page-1' });

      expect(again.find(NOTICE).text()).toContain('Draft a');
    });

    it("never shows another page's notice", async () => {
      const send = vi.fn().mockResolvedValue({ id: 'a', name: 'Draft a' });
      const first = mount({ send, scope: 'page-1' });
      await addFrom(first);
      await flushPromises();

      expect(mount({ send, scope: 'page-2' }).find(NOTICE).exists()).toBe(
        false,
      );
      expect(mount({ send }).find(NOTICE).exists()).toBe(false);
    });
  });

  describe('the button', () => {
    it('is disabled when the page says so, and opens no menu', async () => {
      const wrapper = mount({ disabled: true });

      expect(wrapper.find(BUTTON).attributes()).toHaveProperty('disabled');
      await openMenu(wrapper);
      expect(internalFetch).not.toHaveBeenCalled();
    });

    it('asks the page for a choice first, opening no menu, while one is missing', async () => {
      const wrapper = mount({ needsChoice: true });

      await openMenu(wrapper);

      expect(wrapper.emitted('choose')).toHaveLength(1);
      expect(internalFetch).not.toHaveBeenCalled();
      expect(wrapper.find(DRAFT).exists()).toBe(false);
    });
  });
});
