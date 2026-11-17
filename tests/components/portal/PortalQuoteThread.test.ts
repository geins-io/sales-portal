import { describe, it, expect, vi, beforeEach, assert } from 'vitest';
import type { Ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises } from '@vue/test-utils';
import { mountComponent } from '../../utils/component';
import type { QuoteThread, QuoteThreadEntry } from '#shared/types/quote';
import type { PublicTenantConfig } from '#shared/types/tenant-config';
import { useTenant } from '../../../app/composables/useTenant';
import { useAuthStore } from '../../../app/stores/auth';

// Escapes the tier-wide mock (tests/setup-components.ts): the tenant's
// quoteConversation reaches the log through the real useFeatureAccess.
vi.unmock('../../../app/composables/useFeatureAccess');

// `t` shows the values it is given, so an interpolation can be read.
vi.mock('vue-i18n', async () => {
  const { ref } = await import('vue');
  return {
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) =>
        params ? `${key} ${JSON.stringify(params)}` : key,
      locale: ref('en'),
    }),
  };
});

// The sheet's content renders inline so it can be read without opening it.
vi.mock('../../../app/components/ui/sheet', () => ({
  Sheet: {
    template: '<div data-testid="sheet" :data-open="open"><slot /></div>',
    props: ['open'],
    emits: ['update:open'],
  },
  SheetContent: { template: '<div v-bind="$attrs"><slot /></div>' },
  SheetHeader: { template: '<div><slot /></div>' },
  SheetTitle: { template: '<h2 data-testid="sheet-title"><slot /></h2>' },
  SheetDescription: {
    template: '<p data-testid="sheet-subtitle"><slot /></p>',
  },
}));

// The menu's items render inline, so "Svara" can be clicked without opening it.
vi.mock('../../../app/components/ui/dropdown-menu', () => ({
  DropdownMenu: { template: '<div><slot /></div>' },
  DropdownMenuTrigger: { template: '<div><slot /></div>' },
  DropdownMenuContent: {
    name: 'DropdownMenuContent',
    template: '<div><slot /></div>',
    emits: ['closeAutoFocus'],
  },
  DropdownMenuItem: {
    template:
      '<button type="button" v-bind="$attrs" @click="$emit(\'select\')"><slot /></button>',
    emits: ['select'],
  },
  DropdownMenuSeparator: { template: '<hr />' },
}));

// The dialog renders inline while open, so its copy and buttons can be read.
vi.mock('../../../app/components/ui/dialog', () => ({
  Dialog: {
    template: '<div v-if="open"><slot /></div>',
    props: ['open'],
    emits: ['update:open'],
  },
  DialogContent: { template: '<div v-bind="$attrs"><slot /></div>' },
  DialogHeader: { template: '<div><slot /></div>' },
  DialogFooter: { template: '<div><slot /></div>' },
  DialogTitle: { template: '<h3 data-testid="dialog-title"><slot /></h3>' },
  DialogDescription: {
    template: '<p data-testid="dialog-description"><slot /></p>',
  },
}));

vi.mock('../../../app/utils/internal-fetch', () => ({
  internalFetch: vi.fn(),
}));

const { data, error, refresh, useFetchMock } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref } = require('vue') as typeof import('vue');
  const data = ref<{ thread: QuoteThread } | null>(null);
  const error = ref<Error | null>(null);
  const refresh = vi.fn(async () => {});
  return {
    data,
    error,
    refresh,
    useFetchMock: vi.fn(() => ({ data, error, refresh })),
  };
});
vi.mock('#app/composables/fetch', () => ({ useFetch: useFetchMock }));
vi.stubGlobal('useFetch', useFetchMock);

const { default: PortalQuoteThread } =
  await import('../../../app/components/portal/PortalQuoteThread.vue');
const { internalFetch } = await import('../../../app/utils/internal-fetch');
const fetchMock = vi.mocked(internalFetch);

function thread(entries: QuoteThreadEntry[], messageCount = 0): QuoteThread {
  return { entries, messageCount };
}

async function mountThread() {
  const wrapper = mountComponent(PortalQuoteThread, {
    props: { quoteId: 'q 1', subtitle: '2611-2-0024-00 · Verktyg' },
  });
  await flushPromises();
  return wrapper;
}

const entries = (w: Awaited<ReturnType<typeof mountThread>>) =>
  w.findAll('[data-testid="quote-thread-entry"]');

const { tenant } = useTenant();

function setFeatures(features: PublicTenantConfig['features']) {
  assert.isDefined(tenant.value);
  tenant.value.features = features;
}

const CONVERSATION_ON = {
  quotes: { enabled: true },
  quoteConversation: { enabled: true },
};

beforeEach(() => {
  vi.clearAllMocks();
  (data as Ref<{ thread: QuoteThread } | null>).value = null;
  error.value = null;
  setActivePinia(createPinia());
  setFeatures(CONVERSATION_ON);
  useAuthStore().user = { userId: '1', username: 'buyer@example.com' };
});

describe('PortalQuoteThread', () => {
  it('reads the thread after the page, never holding the page up', async () => {
    await mountThread();

    // Nuxt appends its own key as a third argument.
    const [url, options] = useFetchMock.mock.calls[0] as unknown as [
      string,
      Record<string, unknown>,
    ];
    expect(url).toBe('/api/quotes/q%201/messages');
    expect(options).toMatchObject({ lazy: true, server: false });
  });

  it('labels the button with no icon: the log is an overview first', async () => {
    const wrapper = await mountThread();

    const button = wrapper.find('[data-testid="quote-thread-open"]');
    expect(button.text()).toContain('portal.quotations.thread.open');
    expect(button.find('.icon').exists()).toBe(false);
  });

  it('opens the sheet from the button, and reads the thread again', async () => {
    const wrapper = await mountThread();
    expect(wrapper.find('[data-testid="sheet"]').attributes('data-open')).toBe(
      'false',
    );

    await wrapper.find('[data-testid="quote-thread-open"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="sheet"]').attributes('data-open')).toBe(
      'true',
    );
    expect(refresh).toHaveBeenCalled();
    expect(wrapper.find('[data-testid="sheet-title"]').text()).toBe(
      'portal.quotations.thread.title',
    );
    expect(wrapper.find('[data-testid="sheet-subtitle"]').text()).toBe(
      '2611-2-0024-00 · Verktyg',
    );
  });

  it('counts the messages on the button, and shows no number at none', async () => {
    data.value = { thread: thread([], 3) };
    const wrapper = await mountThread();
    expect(wrapper.find('[data-testid="quote-thread-count"]').text()).toBe('3');

    data.value = { thread: thread([], 0) };
    await flushPromises();
    expect(wrapper.find('[data-testid="quote-thread-count"]').exists()).toBe(
      false,
    );
  });

  it('places the buyer right and the seller left, with name, time and text', async () => {
    data.value = {
      thread: thread(
        [
          {
            id: 'a',
            at: '2026-11-10T08:00:00Z',
            side: 'buyer',
            authorName: 'Anna Berg',
            text: 'Fråga\npå två rader',
          },
          {
            id: 'b',
            at: '2026-11-10T09:30:00Z',
            side: 'seller',
            authorName: 'Erik Sälj',
            text: 'Svar',
          },
        ],
        2,
      ),
    };
    const wrapper = await mountThread();

    const [buyer, seller] = entries(wrapper);
    expect(buyer!.attributes('data-side')).toBe('buyer');
    expect(buyer!.classes()).toContain('ml-8');
    // Green for the buyer, blue for the seller; 6 px whatever the tenant's radius.
    expect(buyer!.classes()).toEqual(
      expect.arrayContaining(['bg-success/8', 'border-success/20']),
    );
    expect(seller!.classes()).toEqual(
      expect.arrayContaining(['bg-info/8', 'border-info/20']),
    );
    for (const box of [buyer!, seller!]) {
      expect(box.classes()).toContain('rounded-[0.375rem]');
      expect(box.classes()).not.toContain('rounded-lg');
    }
    expect(buyer!.text()).toContain('Anna Berg');
    expect(buyer!.text()).toContain('AB');
    // Exactly as written: pre-line would show any added line break.
    expect(
      buyer!.find('[data-testid="quote-thread-text"]').element.textContent,
    ).toBe('Fråga\npå två rader');
    expect(seller!.attributes('data-side')).toBe('seller');
    expect(seller!.classes()).toContain('mr-8');
    // Date and time, in the time zone the tenant shows times in.
    expect(seller!.find('time').attributes('datetime')).toBe(
      '2026-11-10T09:30:00Z',
    );
    expect(seller!.find('time').text()).toMatch(/2026/);
    expect(seller!.find('time').text()).toMatch(/\d{1,2}[:.]30/);
  });

  it('writes an event on its own line under the name, with its text and the status change', async () => {
    data.value = {
      thread: thread(
        [
          {
            id: 'c',
            at: '2026-11-11T12:45:27Z',
            side: 'seller',
            authorName: 'Sara Lind',
            text: 'Vi återkallar denna',
            event: { type: 'canceled', from: 'pending', to: 'canceled' },
          },
          {
            id: 'd',
            at: '2026-11-12T08:00:00Z',
            side: 'seller',
            authorName: 'Sara Lind',
            event: { type: 'ordered', to: 'finalized' },
          },
        ],
        1,
      ),
    };
    const wrapper = await mountThread();

    const [canceled, ordered] = entries(wrapper);
    expect(canceled!.find('[data-testid="quote-thread-event"]').text()).toBe(
      'portal.quotations.thread.event.canceled',
    );
    expect(
      canceled!.find('header [data-testid="quote-thread-event"]').exists(),
    ).toBe(false);
    expect(canceled!.find('[data-testid="quote-thread-text"]').text()).toBe(
      'Vi återkallar denna',
    );
    const change = canceled!.find('[data-testid="quote-thread-change"]');
    expect(change.text()).toContain('portal.quotations.status_pending');
    expect(change.text()).toContain('portal.quotations.status_canceled');
    expect(change.classes()).toContain('sm:flex');

    expect(ordered!.find('[data-testid="quote-thread-event"]').text()).toBe(
      'portal.quotations.thread.event.ordered',
    );
    expect(ordered!.find('[data-testid="quote-thread-text"]').exists()).toBe(
      false,
    );
    expect(ordered!.find('[data-testid="quote-thread-change"]').exists()).toBe(
      false,
    );
  });

  it('names the side when Geins gives no name', async () => {
    data.value = {
      thread: thread([
        {
          id: 'e',
          at: '2026-11-09T21:24:48Z',
          side: 'seller',
          event: { type: 'quote_sent' },
        },
      ]),
    };
    const wrapper = await mountThread();

    const [sent] = entries(wrapper);
    expect(sent!.attributes('data-side')).toBe('seller');
    expect(sent!.text()).toContain('portal.quotations.thread.author.seller');
    expect(sent!.find('[data-testid="quote-thread-event"]').text()).toBe(
      'portal.quotations.thread.event.quote_sent',
    );
  });

  it('shows the message a reply answers above it', async () => {
    data.value = {
      thread: thread(
        [
          {
            id: 'b',
            at: '2026-11-10T09:00:00Z',
            side: 'seller',
            authorName: 'Erik Sälj',
            text: 'Ja',
            replyTo: { authorName: 'Anna Berg', text: 'I gult?' },
          },
        ],
        1,
      ),
    };
    const wrapper = await mountThread();

    const quote = entries(wrapper)[0]!.find(
      '[data-testid="quote-thread-reply"]',
    );
    expect(quote.text()).toContain('Anna Berg');
    expect(quote.text()).toContain('I gult?');
    // A fixed radius like the box's; rounded-lg would follow the tenant's.
    expect(quote.classes()).toContain('rounded-[4px]');
  });

  it('says so when there is nothing in the thread', async () => {
    data.value = { thread: thread([]) };
    const wrapper = await mountThread();

    expect(wrapper.find('[data-testid="quote-thread-empty"]').text()).toBe(
      'portal.quotations.thread.empty',
    );
  });

  it('shows the error in the sheet, and no count, when the thread cannot be read', async () => {
    error.value = new Error('502');
    const wrapper = await mountThread();

    expect(wrapper.find('[data-testid="quote-thread-error"]').text()).toBe(
      'portal.quotations.thread.load_failed',
    );
    expect(wrapper.find('[data-testid="quote-thread-empty"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="quote-thread-count"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="quote-thread-open"]').exists()).toBe(
      true,
    );
  });
  it('outlines the status change so it reads on the tint, the placed order too', async () => {
    data.value = {
      thread: thread(
        [
          {
            id: 'o',
            at: '2026-11-12T08:00:00Z',
            side: 'buyer',
            authorName: 'Anna Berg',
            text: 'Beställt',
            event: { type: 'ordered', from: 'confirmed', to: 'finalized' },
          },
        ],
        1,
      ),
    };
    const wrapper = await mountThread();

    const pills = entries(wrapper)[0]!.findAll(
      '[data-testid="quote-thread-change"] [data-slot="badge"]',
    );
    expect(pills).toHaveLength(2);
    for (const pill of pills) {
      expect(pill.classes()).toEqual(
        expect.arrayContaining(['bg-card', 'border-current/30']),
      );
    }
    // A solid badge has white text: on a white pill it must take its colour.
    expect(pills[1]!.classes()).toContain('text-success');
    expect(pills[1]!.classes()).not.toContain('text-white');
  });

  describe('writing', () => {
    const SELLER_MESSAGE: QuoteThreadEntry = {
      id: '3f2b8c1e-5d4a-4e6b-9c7d-1a2b3c4d5e6f',
      at: '2026-11-10T09:00:00Z',
      side: 'seller',
      authorName: 'Erik Sälj',
      text: 'Vi kan leverera i december.',
    };
    const QUOTE_SENT: QuoteThreadEntry = {
      id: '7a1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e',
      at: '2026-11-09T21:24:48Z',
      side: 'seller',
      event: { type: 'quote_sent', from: 'requested', to: 'pending' },
    };

    const composer = (w: Awaited<ReturnType<typeof mountThread>>) =>
      w.find('[data-testid="quote-thread-composer"]');
    const replyOn = (w: Awaited<ReturnType<typeof mountThread>>, i: number) =>
      entries(w)[i]!.find('[data-testid="quote-thread-reply-action"]');

    beforeEach(() => {
      fetchMock.mockResolvedValue({ message: { id: 'm-9' } });
    });

    it('has the field at the bottom of the sheet, also on an empty thread', async () => {
      data.value = { thread: thread([]) };
      const wrapper = await mountThread();

      expect(composer(wrapper).exists()).toBe(true);
    });

    it('has no field while the thread cannot be read', async () => {
      error.value = new Error('502');
      const wrapper = await mountThread();

      expect(composer(wrapper).exists()).toBe(false);
    });

    it('offers "Svara" in the menu of every entry, labelled for a screen reader', async () => {
      data.value = { thread: thread([QUOTE_SENT, SELLER_MESSAGE], 1) };
      const wrapper = await mountThread();

      for (const i of [0, 1]) {
        expect(replyOn(wrapper, i).text()).toBe(
          'portal.quotations.thread.reply',
        );
        const more = entries(wrapper)[i]!.find(
          '[data-testid="quote-thread-more"]',
        );
        expect(more.attributes('aria-label')).toBe(
          'portal.quotations.thread.more',
        );
      }
    });

    it('"Svara" quotes the message above the field', async () => {
      data.value = { thread: thread([SELLER_MESSAGE], 1) };
      const wrapper = await mountThread();

      await replyOn(wrapper, 0).trigger('click');

      const chip = wrapper.find('[data-testid="quote-thread-replying"]');
      expect(chip.text()).toContain('{"name":"Erik Sälj"}');
      expect(chip.text()).toContain('Vi kan leverera i december.');
    });

    it('gives the field the focus the menu hands back to ⋯ after "Svara", and only then', async () => {
      data.value = { thread: thread([SELLER_MESSAGE], 1) };
      const wrapper = mountComponent(PortalQuoteThread, {
        props: { quoteId: 'q 1', subtitle: '2611-2-0024-00 · Verktyg' },
        attachTo: document.body,
      });
      await flushPromises();
      const menu = wrapper.findComponent({ name: 'DropdownMenuContent' });
      const closing = () =>
        new Event('focus.autoFocusOnClose', { cancelable: true });

      const dismissed = closing();
      menu.vm.$emit('closeAutoFocus', dismissed);
      expect(dismissed.defaultPrevented).toBe(false);

      await replyOn(wrapper, 0).trigger('click');
      const afterReply = closing();
      menu.vm.$emit('closeAutoFocus', afterReply);
      await flushPromises();

      expect(afterReply.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(
        wrapper.find('[data-testid="quote-thread-input"]').element,
      );
      const next = closing();
      menu.vm.$emit('closeAutoFocus', next);
      expect(next.defaultPrevented).toBe(false);
      wrapper.unmount();
    });

    it('quotes what happened when the entry has no text, and the side when it has no name', async () => {
      data.value = { thread: thread([QUOTE_SENT]) };
      const wrapper = await mountThread();

      await replyOn(wrapper, 0).trigger('click');

      const chip = wrapper.find('[data-testid="quote-thread-replying"]');
      expect(chip.text()).toContain(
        '{"name":"portal.quotations.thread.author.seller"}',
      );
      expect(chip.text()).toContain(
        'portal.quotations.thread.event.quote_sent',
      );
    });

    it('reads the thread again after a send, so the count follows', async () => {
      data.value = { thread: thread([SELLER_MESSAGE], 1) };
      const wrapper = await mountThread();
      refresh.mockClear();

      await wrapper
        .find('[data-testid="quote-thread-input"]')
        .setValue('Det går bra.');
      await wrapper.find('[data-testid="quote-thread-send"]').trigger('click');
      await flushPromises();

      // Not deferred to a read that may have left before the write landed.
      expect(refresh).toHaveBeenCalledExactlyOnceWith({ dedupe: 'cancel' });
    });

    describe('when a send fails', () => {
      beforeEach(() => {
        fetchMock.mockRejectedValue(new Error('502'));
      });

      async function failReplyTo(after: QuoteThreadEntry[]) {
        data.value = { thread: thread([SELLER_MESSAGE], 1) };
        const wrapper = await mountThread();
        refresh.mockImplementationOnce(async () => {
          data.value = { thread: thread(after, after.length) };
        });
        await replyOn(wrapper, 0).trigger('click');
        await wrapper
          .find('[data-testid="quote-thread-input"]')
          .setValue('Det går bra.');
        await wrapper
          .find('[data-testid="quote-thread-send"]')
          .trigger('click');
        await flushPromises();
        return wrapper;
      }

      it('reads the thread again and keeps the reply while its message is there', async () => {
        const wrapper = await failReplyTo([SELLER_MESSAGE]);

        expect(refresh).toHaveBeenCalledWith({ dedupe: 'cancel' });
        expect(
          wrapper.find('[data-testid="quote-thread-replying"]').exists(),
        ).toBe(true);
      });

      it('drops the reply when its message is gone, keeping the text for a plain send', async () => {
        const wrapper = await failReplyTo([]);

        expect(
          wrapper.find('[data-testid="quote-thread-replying"]').exists(),
        ).toBe(false);
        expect(
          (
            wrapper.find('[data-testid="quote-thread-input"]')
              .element as HTMLTextAreaElement
          ).value,
        ).toBe('Det går bra.');
      });
    });
  });

  describe('deleting', () => {
    const MINE: QuoteThreadEntry = {
      id: '0b6f4c2a-1d3e-4f5a-8b7c-9d0e1f2a3b4c',
      at: '2026-11-10T10:00:00Z',
      side: 'buyer',
      authorName: 'Anna Berg',
      text: 'Ja, det kör vi på.',
      deletable: true,
    };
    const LOCKED: QuoteThreadEntry = {
      id: '5c4d3e2f-1a0b-4c9d-8e7f-6a5b4c3d2e1f',
      at: '2026-11-10T08:00:00Z',
      side: 'buyer',
      authorName: 'Anna Berg',
      text: 'Går det att leverera i december?',
    };
    const ANSWER: QuoteThreadEntry = {
      id: '9e8d7c6b-5a4f-4e3d-2c1b-0a9f8e7d6c5b',
      at: '2026-11-10T09:00:00Z',
      side: 'seller',
      authorName: 'Erik Sälj',
      text: 'Ja, vecka 50.',
    };

    const deleteOn = (w: Awaited<ReturnType<typeof mountThread>>, i: number) =>
      entries(w)[i]!.find('[data-testid="quote-thread-delete-action"]');
    const dialog = (w: Awaited<ReturnType<typeof mountThread>>) =>
      w.find('[data-testid="quote-action-dialog"]');
    const notice = (w: Awaited<ReturnType<typeof mountThread>>) =>
      w.find('[data-testid="quote-thread-notice"]');

    async function confirmDelete(
      w: Awaited<ReturnType<typeof mountThread>>,
      i: number,
    ) {
      await deleteOn(w, i).trigger('click');
      await w.find('[data-testid="quote-action-confirm"]').trigger('click');
      await flushPromises();
    }

    beforeEach(() => {
      fetchMock.mockResolvedValue({ deleted: true });
    });

    it('offers "Radera" only on a message the buyer may delete', async () => {
      data.value = { thread: thread([LOCKED, ANSWER, MINE], 3) };
      const wrapper = await mountThread();

      expect(deleteOn(wrapper, 0).exists()).toBe(false);
      expect(deleteOn(wrapper, 1).exists()).toBe(false);
      expect(deleteOn(wrapper, 2).text()).toBe(
        'portal.quotations.thread.delete',
      );
    });

    it('"Radera" asks first, and cancelling sends nothing', async () => {
      data.value = { thread: thread([MINE], 1) };
      const wrapper = await mountThread();
      expect(dialog(wrapper).exists()).toBe(false);

      await deleteOn(wrapper, 0).trigger('click');

      expect(wrapper.find('[data-testid="dialog-title"]').text()).toBe(
        'portal.quotations.thread.delete_title',
      );
      expect(wrapper.find('[data-testid="dialog-description"]').text()).toBe(
        'portal.quotations.thread.delete_body',
      );
      const confirm = wrapper.find('[data-testid="quote-action-confirm"]');
      expect(confirm.text()).toBe('portal.quotations.thread.delete');
      // A delete carries no message to the seller.
      expect(
        wrapper.find('[data-testid="quote-action-message"]').exists(),
      ).toBe(false);

      await wrapper
        .find('[data-testid="quote-action-cancel"]')
        .trigger('click');

      expect(dialog(wrapper).exists()).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('deletes on confirm, reads the thread again, and drops a reply to it', async () => {
      data.value = { thread: thread([MINE], 1) };
      const wrapper = mountComponent(PortalQuoteThread, {
        props: { quoteId: 'q 1', subtitle: '2611-2-0024-00 · Verktyg' },
        attachTo: document.body,
      });
      await flushPromises();
      await entries(wrapper)[0]!
        .find('[data-testid="quote-thread-reply-action"]')
        .trigger('click');
      refresh.mockClear();
      refresh.mockImplementationOnce(async () => {
        data.value = { thread: thread([], 0) };
      });

      await confirmDelete(wrapper, 0);

      expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
        `/api/quotes/q%201/messages/${MINE.id}`,
        { method: 'DELETE' },
      );
      expect(refresh).toHaveBeenCalledExactlyOnceWith({ dedupe: 'cancel' });
      expect(dialog(wrapper).exists()).toBe(false);
      expect(entries(wrapper)).toHaveLength(0);
      expect(
        wrapper.find('[data-testid="quote-thread-replying"]').exists(),
      ).toBe(false);
      expect(notice(wrapper).exists()).toBe(false);
      // The ⋯ that opened the menu is gone with its message.
      expect(document.activeElement).toBe(
        wrapper.find('[data-testid="quote-thread-input"]').element,
      );
      wrapper.unmount();
    });

    it('holds the confirm button while the delete runs', async () => {
      data.value = { thread: thread([MINE], 1) };
      const wrapper = await mountThread();
      let finish: (value: unknown) => void = () => {};
      fetchMock.mockReturnValueOnce(new Promise((r) => (finish = r)));

      await deleteOn(wrapper, 0).trigger('click');
      await wrapper
        .find('[data-testid="quote-action-confirm"]')
        .trigger('click');

      expect(
        wrapper.find('[data-testid="quote-action-confirm"]').attributes(),
      ).toHaveProperty('disabled');
      finish({ deleted: true });
      await flushPromises();
    });

    describe('when the message became locked meanwhile', () => {
      beforeEach(() => {
        fetchMock.mockRejectedValue(
          Object.assign(new Error('409'), { statusCode: 409 }),
        );
      });

      it('reads again, scrolls to the newest entry, and says so', async () => {
        data.value = { thread: thread([MINE], 1) };
        const wrapper = await mountThread();
        const list = wrapper.find('[data-testid="quote-thread-list"]')
          .element as HTMLElement;
        Object.defineProperty(list, 'scrollHeight', { value: 840 });
        list.scrollTop = 0;
        refresh.mockClear();
        refresh.mockImplementationOnce(async () => {
          data.value = {
            thread: thread([{ ...MINE, deletable: undefined }, ANSWER], 2),
          };
        });

        await confirmDelete(wrapper, 0);

        expect(refresh).toHaveBeenCalledExactlyOnceWith({ dedupe: 'cancel' });
        expect(dialog(wrapper).exists()).toBe(false);
        expect(notice(wrapper).attributes('role')).toBe('alert');
        expect(notice(wrapper).text()).toBe(
          'portal.quotations.thread.delete_locked',
        );
        expect(deleteOn(wrapper, 0).exists()).toBe(false);
        expect(entries(wrapper)).toHaveLength(2);
        expect(list.scrollTop).toBe(840);
      });

      it('clears the notice on the next send', async () => {
        data.value = { thread: thread([MINE], 1) };
        const wrapper = await mountThread();
        await confirmDelete(wrapper, 0);
        expect(notice(wrapper).exists()).toBe(true);
        fetchMock.mockResolvedValue({ message: { id: 'm-9' } });

        await wrapper
          .find('[data-testid="quote-thread-input"]')
          .setValue('Ok.');
        await wrapper
          .find('[data-testid="quote-thread-send"]')
          .trigger('click');
        await flushPromises();

        expect(notice(wrapper).exists()).toBe(false);
      });
    });

    it('reads again and says nothing when the message is already gone', async () => {
      fetchMock.mockRejectedValue(
        Object.assign(new Error('404'), { statusCode: 404 }),
      );
      data.value = { thread: thread([MINE], 1) };
      const wrapper = await mountThread();
      refresh.mockClear();

      await confirmDelete(wrapper, 0);

      expect(refresh).toHaveBeenCalledExactlyOnceWith({ dedupe: 'cancel' });
      expect(dialog(wrapper).exists()).toBe(false);
      expect(notice(wrapper).exists()).toBe(false);
    });

    it('reads again and says the delete failed on any other answer', async () => {
      fetchMock.mockRejectedValue(
        Object.assign(new Error('502'), { statusCode: 502 }),
      );
      data.value = { thread: thread([MINE], 1) };
      const wrapper = await mountThread();
      refresh.mockClear();

      await confirmDelete(wrapper, 0);

      expect(refresh).toHaveBeenCalledExactlyOnceWith({ dedupe: 'cancel' });
      expect(dialog(wrapper).exists()).toBe(false);
      expect(notice(wrapper).text()).toBe(
        'portal.quotations.thread.delete_failed',
      );
    });
  });
  it('has the field and the menu when quotes and quoteConversation are enabled', async () => {
    data.value = {
      thread: thread(
        [
          {
            id: 'm-1',
            at: '2026-11-10T10:00:00Z',
            side: 'seller',
            authorName: 'Erik Sälj',
            text: 'Hej',
          },
        ],
        1,
      ),
    };
    const wrapper = await mountThread();

    expect(wrapper.find('[data-testid="quote-thread-composer"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="quote-thread-more"]').exists()).toBe(
      true,
    );
  });

  describe('with the conversation off', () => {
    const MESSAGE: QuoteThreadEntry = {
      id: '0b6f4c2a-1d3e-4f5a-8b7c-9d0e1f2a3b4c',
      at: '2026-11-10T10:00:00Z',
      side: 'buyer',
      authorName: 'Anna Berg',
      text: 'Ja, det kör vi på.',
      deletable: true,
    };

    async function mountReadOnly(features: PublicTenantConfig['features']) {
      setFeatures(features);
      data.value = { thread: thread([MESSAGE], 1) };
      const wrapper = await mountThread();

      expect(entries(wrapper)).toHaveLength(1);
      expect(
        entries(wrapper)[0]!.find('[data-testid="quote-thread-text"]').text(),
      ).toBe('Ja, det kör vi på.');
      expect(
        wrapper.find('[data-testid="quote-thread-composer"]').exists(),
      ).toBe(false);
      expect(wrapper.find('[data-testid="quote-thread-more"]').exists()).toBe(
        false,
      );
      expect(
        wrapper.find('[data-testid="quote-thread-delete-action"]').exists(),
      ).toBe(false);
    }

    it('shows the log to read, with no field and no menu, when quoteConversation is disabled', async () => {
      await mountReadOnly({
        quotes: { enabled: true },
        quoteConversation: { enabled: false },
      });
    });

    it('shows the log to read, with no field and no menu, when the tenant stores no quoteConversation', async () => {
      await mountReadOnly({ quotes: { enabled: true } });
    });

    it('says the log is empty without asking the buyer to write', async () => {
      setFeatures({ quotes: { enabled: true } });
      data.value = { thread: thread([]) };
      const wrapper = await mountThread();

      expect(wrapper.find('[data-testid="quote-thread-empty"]').text()).toBe(
        'portal.quotations.thread.empty_read_only',
      );
    });
  });
});
