import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h, ref, Suspense } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { defaultMountOptions } from '../../utils/component';
import type {
  Quote,
  QuoteLineItem,
  QuoteRequestUpdate,
  QuoteStatus,
} from '../../../shared/types/quote';
import { makeQuote } from '../../fixtures/quote';
import {
  AMOUNT_SAVE_DELAY_MS,
  UNDO_WINDOW_MS,
} from '../../../app/composables/useQuoteDraftEditing';

/** The editable quotation view: a `REQUEST_DRAFT`. */

const {
  mockData,
  mockRefresh,
  mockReread,
  mockUpdateDraft,
  mockDeleteDraft,
  mockStoreError,
  mockIsSaving,
  mockCanRequestQuotes,
  leaveGuards,
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref } = require('vue') as typeof import('vue');
  return {
    mockData: ref<{ quote: Quote } | null>(null),
    mockRefresh: vi.fn(),
    mockReread: vi.fn<(url: string) => Promise<{ quote: Quote }>>(),
    mockUpdateDraft:
      vi.fn<
        (id: string, update: QuoteRequestUpdate) => Promise<Quote | null>
      >(),
    mockDeleteDraft: vi.fn<(id: string) => Promise<boolean>>(),
    mockStoreError: ref<string | null>(null),
    mockIsSaving: ref(false),
    mockCanRequestQuotes: ref(true),
    leaveGuards: [] as (() => Promise<boolean | undefined>)[],
  };
});

// The page reads the draft again after a failed save with `$fetch`.
vi.mock('#build/fetch', () => ({
  $fetch: (url: string) => mockReread(url),
}));

vi.stubGlobal('definePageMeta', vi.fn());
const navigateToMock = vi.fn();
vi.stubGlobal('navigateTo', navigateToMock);
vi.stubGlobal('createError', (o: { statusMessage?: string }) =>
  Object.assign(new Error(o.statusMessage), o),
);

const fetchResult = () => ({
  data: mockData,
  error: ref(null),
  pending: ref(false),
  refresh: mockRefresh,
  status: { value: 'success' },
});
vi.mock('#app/composables/fetch', () => ({ useFetch: () => fetchResult() }));
vi.stubGlobal('useFetch', () => fetchResult());

vi.mock('vue-router', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  onBeforeRouteLeave: (guard: () => Promise<boolean | undefined>) => {
    leaveGuards.push(guard);
  },
}));

const route = {
  params: { id: 'q-001' },
  path: '/portal/quotations/q-001',
  query: {},
  hash: '',
  fullPath: '/portal/quotations/q-001',
  name: 'portal-quotations-id',
  matched: [],
  meta: {},
};
vi.stubGlobal('useRoute', () => route);
vi.mock('#app/composables/router', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  useRoute: () => route,
  navigateTo: (...args: unknown[]) => navigateToMock(...args),
}));

vi.mock('../../../app/composables/useFeatureAccess', () => ({
  useFeatureAccess: () => ({
    canAccess: () => true,
    canRequestQuotes: () => mockCanRequestQuotes.value,
  }),
}));

vi.mock('../../../app/stores/quotes', () => ({
  useQuotesStore: () => ({
    currentQuote: null,
    isActionLoading: false,
    get isSaving() {
      return mockIsSaving.value;
    },
    get error() {
      return mockStoreError.value;
    },
    set error(value: string | null) {
      mockStoreError.value = value;
    },
    updateDraft: (id: string, update: QuoteRequestUpdate) =>
      mockUpdateDraft(id, update),
    deleteDraft: (id: string) => mockDeleteDraft(id),
  }),
}));

const { default: PortalQuotationDetail } =
  await import('../../../app/pages/portal/quotations/[id]/index.vue');

const stubs = {
  PortalShell: { template: '<div><slot /></div>' },
  Button: {
    inheritAttrs: false,
    props: ['asChild', 'disabled'],
    emits: ['click'],
    template:
      '<div v-if="asChild" v-bind="$attrs"><slot /></div><button v-else v-bind="$attrs" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  DropdownMenu: { template: '<div><slot /></div>' },
  DropdownMenuTrigger: { template: '<div><slot /></div>' },
  // A pick closes the menu: the click bubbles up as its close-auto-focus.
  DropdownMenuContent: {
    emits: ['close-auto-focus'],
    template:
      '<div @click="$emit(\'close-auto-focus\', $event)"><slot /></div>',
  },
  DropdownMenuItem: {
    emits: ['select'],
    template:
      '<button v-bind="$attrs" @click="$emit(\'select\', $event)"><slot /></button>',
  },
  PortalQuoteDraftTable: {
    props: ['lines', 'totals'],
    emits: ['quantity', 'remove'],
    template: `<div data-testid="draft-table">
      <div v-for="line in lines" :key="line.id" data-testid="draft-line" :data-id="line.id" :data-quantity="line.quantity">
        <button data-testid="draft-line-more" @click="$emit('quantity', line, line.quantity + 1)" />
        <button data-testid="draft-line-remove" @click="$emit('remove', line)" />
      </div>
    </div>`,
  },
  PortalQuoteQuickAdd: {
    props: ['pending'],
    emits: ['add'],
    template:
      '<button data-testid="quick-add" @click="$emit(\'add\', { skuId: 77, name: \'Product 77\' })" />',
  },
  PortalDialogDeleteQuoteDraft: {
    props: ['open', 'name', 'pending', 'lastLine'],
    emits: ['update:open', 'confirm'],
    template:
      '<div v-if="open" data-testid="delete-dialog" :data-name="name" :data-last-line="String(!!lastLine)"><button data-testid="delete-confirm" @click="$emit(\'confirm\')" /><button data-testid="delete-cancel" @click="$emit(\'update:open\', false)" /></div>',
  },
  OrderItemsTable: { template: '<div data-testid="order-items-table" />' },
  PortalItemRowsSheet: { template: '<div data-testid="rows-sheet" />' },
  QuoteEstimateBadge: { template: '<span data-testid="estimate-badge" />' },
};

function line(id: string, skuId: number, quantity: number): QuoteLineItem {
  const [base] = makeQuote().lineItems;
  return { ...base!, id, skuId, quantity, name: `Product ${skuId}` };
}

const draft = (overrides: Partial<Quote> = {}) =>
  makeQuote({
    status: 'request_draft',
    name: 'Kontor plan 3',
    lineItems: [line('line-a', 11, 2), line('line-b', 12, 1)],
    company: { name: 'Acme AB' },
    ...overrides,
  });

/** Geins answers a write with the draft as it now is. */
function geinsAnswers() {
  mockUpdateDraft.mockImplementation(async (_id, update) => {
    const current = mockData.value!.quote;
    const lineItems = update.items
      ? update.items.map((item) => {
          const kept = current.lineItems.find((l) => l.id === item.id);
          return kept
            ? { ...kept, quantity: item.quantity }
            : line(`new-${item.skuId}`, item.skuId, item.quantity);
        })
      : current.lineItems;
    return { ...current, name: update.name ?? current.name, lineItems };
  });
}

let wrapper: ReturnType<typeof mount>;

async function mountWith(quote: Quote) {
  mockData.value = { quote };
  const Wrapper = defineComponent({
    setup: () => () =>
      h(Suspense, null, { default: () => h(PortalQuotationDetail) }),
  });
  wrapper = mount(Wrapper, {
    ...defaultMountOptions,
    attachTo: document.body,
    global: {
      ...defaultMountOptions.global,
      stubs: { ...defaultMountOptions.global.stubs, ...stubs },
    },
  });
  await flushPromises();
  return wrapper;
}

const find = (id: string) => wrapper.find(`[data-testid="${id}"]`);
const lineIds = () =>
  wrapper
    .findAll('[data-testid="draft-line"]')
    .map((l) => l.attributes('data-id'));

async function startRename() {
  await find('quote-rename').trigger('click');
  await flushPromises();
  return find('quote-name-input');
}

beforeEach(() => {
  vi.useFakeTimers();
  mockUpdateDraft.mockReset();
  mockDeleteDraft.mockReset();
  mockRefresh.mockReset();
  mockReread.mockReset();
  navigateToMock.mockReset();
  mockStoreError.value = null;
  mockIsSaving.value = false;
  mockCanRequestQuotes.value = true;
  leaveGuards.length = 0;
});

afterEach(() => {
  wrapper?.unmount();
  vi.useRealTimers();
});

describe('the quotation view of a request draft', () => {
  it('is edited: quick add and the editable lines, not the read-only table', async () => {
    await mountWith(draft());

    expect(find('quick-add').exists()).toBe(true);
    expect(lineIds()).toEqual(['line-a', 'line-b']);
    expect(find('order-items-table').exists()).toBe(false);
    expect(find('rows-sheet').exists()).toBe(false);
    expect(find('quote-more').exists()).toBe(true);
  });

  it('keeps the lines on the page at phone width, under the summary', async () => {
    await mountWith(draft());
    const lines = find('quote-draft-lines');

    expect(lines.classes()).not.toContain('hidden');
    expect(lines.classes()).toContain('order-2');
  });

  it.each<QuoteStatus>(['requested', 'pending', 'accepted', 'finalized'])(
    'stays read-only once it is %s',
    async (status) => {
      await mountWith(draft({ status }));

      expect(find('order-items-table').exists()).toBe(true);
      for (const id of [
        'quick-add',
        'draft-table',
        'quote-more',
        'quote-continue',
      ]) {
        expect(find(id).exists()).toBe(false);
      }
    },
  );

  it('marks the sum as an estimate and has no customer card', async () => {
    await mountWith(draft());

    expect(find('estimate-badge').exists()).toBe(true);
    expect(find('customer-info-card').exists()).toBe(false);
  });

  it('says when it was last changed', async () => {
    await mountWith(draft({ updatedAt: '2026-11-10T12:00:00Z' }));

    expect(find('quote-meta-updated').exists()).toBe(true);
  });

  it('goes on to the request page, with the hint below', async () => {
    await mountWith(draft());

    expect(find('quote-continue').find('a').attributes('href')).toBe(
      '/se/en/portal/quotations/q-001/request',
    );
    expect(find('quote-continue-hint').text()).toBe(
      'portal.quotations.draft.continue_hint',
    );
  });

  describe('renaming', () => {
    it('saves the new name, trimmed, on Enter, and shows it', async () => {
      await mountWith(draft());
      geinsAnswers();
      const input = await startRename();
      expect((input.element as HTMLInputElement).value).toBe('Kontor plan 3');
      expect(document.activeElement).toBe(input.element);

      await input.setValue('  Kontor plan 4 ');
      await find('quote-name-form').trigger('submit');
      await flushPromises();

      expect(mockUpdateDraft).toHaveBeenCalledWith('q-001', {
        name: 'Kontor plan 4',
      });
      expect(find('quote-name-input').exists()).toBe(false);
      expect(find('quote-title').text()).toBe('Kontor plan 4');
    });

    it('saves when the field loses focus', async () => {
      await mountWith(draft());
      geinsAnswers();
      const input = await startRename();

      await input.setValue('Lager B');
      await input.trigger('blur');
      await flushPromises();

      expect(mockUpdateDraft).toHaveBeenCalledWith('q-001', {
        name: 'Lager B',
      });
    });

    it('drops the change on Escape', async () => {
      await mountWith(draft());
      const input = await startRename();

      await input.setValue('Lager B');
      await input.trigger('keydown', { key: 'Escape' });
      await flushPromises();

      expect(mockUpdateDraft).not.toHaveBeenCalled();
      expect(find('quote-title').text()).toBe('Kontor plan 3');
    });

    it.each([
      ['an empty name', '   '],
      ['the same name', 'Kontor plan 3'],
    ])('saves nothing for %s', async (_label, text) => {
      await mountWith(draft());
      const input = await startRename();

      await input.setValue(text);
      await find('quote-name-form').trigger('submit');
      await flushPromises();

      expect(mockUpdateDraft).not.toHaveBeenCalled();
    });

    it('caps the name at 80 characters', async () => {
      await mountWith(draft());
      const input = await startRename();

      expect(input.attributes('maxlength')).toBe('80');
    });
  });

  describe('saving', () => {
    it('saves a new amount after a pause, and says when all is saved', async () => {
      await mountWith(draft());
      geinsAnswers();
      expect(find('quote-save-state').exists()).toBe(false);

      await wrapper
        .findAll('[data-testid="draft-line-more"]')[0]!
        .trigger('click');
      expect(find('quote-save-state').text()).toBe(
        'portal.quotations.draft.saving',
      );
      await vi.advanceTimersByTimeAsync(AMOUNT_SAVE_DELAY_MS);
      await flushPromises();

      expect(mockUpdateDraft).toHaveBeenCalledWith('q-001', {
        items: [
          { id: 'line-a', skuId: 11, quantity: 3 },
          { id: 'line-b', skuId: 12, quantity: 1 },
        ],
      });
      expect(find('quote-save-state').text()).toBe(
        'portal.quotations.draft.saved',
      );
    });

    it('adds a product from quick add and says so', async () => {
      await mountWith(draft());
      geinsAnswers();

      await find('quick-add').trigger('click');
      await flushPromises();

      expect(mockUpdateDraft.mock.calls[0]![1].items!.at(-1)).toEqual({
        skuId: 77,
        quantity: 1,
      });
      expect(find('quote-notice').text()).toContain(
        'portal.quotations.draft.added',
      );
      expect(lineIds()).toEqual(['line-a', 'line-b', 'new-77']);
    });

    it('re-reads the draft and says so when a save fails', async () => {
      await mountWith(draft());
      mockUpdateDraft.mockImplementation(async () => {
        mockStoreError.value = 'portal.quotations.draft.save_failed';
        return null;
      });
      mockReread.mockResolvedValue({
        quote: draft({ lineItems: [line('line-a', 11, 9)] }),
      });

      await find('quick-add').trigger('click');
      await flushPromises();

      expect(mockReread).toHaveBeenCalledWith('/api/quotes/q-001');
      expect(lineIds()).toEqual(['line-a']);
      expect(find('draft-error').text()).toBe(
        'portal.quotations.draft.save_failed',
      );
      expect(mockRefresh).not.toHaveBeenCalled();
    });

    it('keeps the draft on the page when the re-read fails too, and saves the next change', async () => {
      await mountWith(draft());
      mockUpdateDraft.mockImplementationOnce(async () => {
        mockStoreError.value = 'portal.quotations.draft.save_failed';
        return null;
      });
      mockReread.mockRejectedValue(new Error('502'));

      await find('quick-add').trigger('click');
      await flushPromises();

      expect(find('quote-draft-lines').exists()).toBe(true);
      expect(lineIds()).toEqual(['line-a', 'line-b']);
      expect(find('draft-error').text()).toBe(
        'portal.quotations.draft.save_failed',
      );

      geinsAnswers();
      await wrapper
        .findAll('[data-testid="draft-line-more"]')[0]!
        .trigger('click');
      await vi.advanceTimersByTimeAsync(AMOUNT_SAVE_DELAY_MS);
      await flushPromises();

      expect(mockUpdateDraft).toHaveBeenCalledTimes(2);
      expect(mockUpdateDraft.mock.calls[1]![1].items![0]).toEqual({
        id: 'line-a',
        skuId: 11,
        quantity: 3,
      });
    });
  });

  describe('removing a line', () => {
    it('takes it away at once and puts it back on undo, saving nothing', async () => {
      await mountWith(draft());

      await wrapper
        .findAll('[data-testid="draft-line-remove"]')[0]!
        .trigger('click');
      expect(lineIds()).toEqual(['line-b']);
      expect(find('quote-notice').text()).toContain(
        'portal.quotations.draft.removed',
      );

      await find('quote-undo').trigger('click');

      expect(lineIds()).toEqual(['line-a', 'line-b']);
      expect(find('quote-notice').exists()).toBe(false);
      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
      expect(mockUpdateDraft).not.toHaveBeenCalled();
    });

    it('saves the removal when the undo window closes', async () => {
      await mountWith(draft());
      geinsAnswers();

      await wrapper
        .findAll('[data-testid="draft-line-remove"]')[0]!
        .trigger('click');
      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
      await flushPromises();

      expect(mockUpdateDraft).toHaveBeenCalledWith('q-001', {
        items: [{ id: 'line-b', skuId: 12, quantity: 1 }],
      });
    });
  });

  describe('removing the last line', () => {
    it('asks first, since it deletes the draft', async () => {
      await mountWith(draft({ lineItems: [line('line-a', 11, 2)] }));

      await find('draft-line-remove').trigger('click');

      expect(find('delete-dialog').attributes('data-last-line')).toBe('true');
      expect(find('quote-notice').exists()).toBe(false);
      expect(lineIds()).toEqual(['line-a']);
    });

    it('changes nothing on cancel', async () => {
      await mountWith(draft({ lineItems: [line('line-a', 11, 2)] }));

      await find('draft-line-remove').trigger('click');
      await find('delete-cancel').trigger('click');
      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);

      expect(find('delete-dialog').exists()).toBe(false);
      expect(lineIds()).toEqual(['line-a']);
      expect(mockUpdateDraft).not.toHaveBeenCalled();
      expect(mockDeleteDraft).not.toHaveBeenCalled();
    });

    it('deletes the draft and goes to the list on confirm', async () => {
      await mountWith(draft({ lineItems: [line('line-a', 11, 2)] }));
      mockDeleteDraft.mockResolvedValue(true);

      await find('draft-line-remove').trigger('click');
      await find('delete-confirm').trigger('click');
      await flushPromises();

      expect(mockDeleteDraft).toHaveBeenCalledWith('q-001');
      expect(navigateToMock).toHaveBeenCalledWith('/se/en/portal/quotations');
    });

    it('counts a line waiting for undo as gone', async () => {
      await mountWith(draft());

      await wrapper
        .findAll('[data-testid="draft-line-remove"]')[0]!
        .trigger('click');
      await find('draft-line-remove').trigger('click');

      expect(find('delete-dialog').attributes('data-last-line')).toBe('true');
    });

    it('asks about the whole draft from the menu', async () => {
      await mountWith(draft());

      await find('quote-delete').trigger('click');

      expect(find('delete-dialog').attributes('data-last-line')).toBe('false');
    });
  });

  // The tenant's quoteRequests setting is off: the draft is read, not edited.
  describe('when the buyer may not work on quote requests', () => {
    beforeEach(() => {
      mockCanRequestQuotes.value = false;
    });

    it('shows the draft read-only: the lines table, no editing, no way on', async () => {
      await mountWith(draft());

      expect(find('order-items-table').exists()).toBe(true);
      expect(find('rows-sheet').exists()).toBe(true);
      for (const id of [
        'quote-draft-lines',
        'quick-add',
        'draft-table',
        'quote-more',
        'quote-rename',
        'quote-delete',
        'quote-continue',
        'quote-continue-hint',
        'delete-dialog',
      ]) {
        expect(find(id).exists(), id).toBe(false);
      }
    });

    it('still reads as a draft: the estimate, the last change, no customer card', async () => {
      await mountWith(draft({ updatedAt: '2026-11-10T12:00:00Z' }));

      expect(find('estimate-badge').exists()).toBe(true);
      expect(find('quote-meta-updated').exists()).toBe(true);
      expect(find('customer-info-card').exists()).toBe(false);
      expect(find('quote-title').text()).toBe('Kontor plan 3');
    });

    it('neither holds up leaving nor asks on closing the tab', async () => {
      await mountWith(draft());
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);

      expect(leaveGuards).toHaveLength(0);
      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe('closing or reloading the tab', () => {
    const unload = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event;
    };

    it('asks first while a change is not saved yet', async () => {
      await mountWith(draft());

      await wrapper
        .findAll('[data-testid="draft-line-remove"]')[0]!
        .trigger('click');
      const event = unload();

      expect(event.defaultPrevented).toBe(true);
      // Older Chrome and Safari ask only when returnValue is set.
      expect((event as BeforeUnloadEvent).returnValue).toBe('');
    });

    it('lets the tab go once everything is saved', async () => {
      await mountWith(draft());

      expect(unload().defaultPrevented).toBe(false);
    });

    it('does not ask for a read-only quotation', async () => {
      await mountWith(draft({ status: 'pending' }));

      expect(unload().defaultPrevented).toBe(false);
    });
  });

  describe('leaving the view', () => {
    it('saves a waiting removal first, and lets the buyer go', async () => {
      await mountWith(draft());
      geinsAnswers();
      await wrapper
        .findAll('[data-testid="draft-line-remove"]')[0]!
        .trigger('click');

      expect(leaveGuards).toHaveLength(1);
      const result = await leaveGuards[0]!();

      expect(mockUpdateDraft).toHaveBeenCalledTimes(1);
      expect(result).not.toBe(false);
    });

    it('keeps the buyer on the view when that save fails', async () => {
      await mountWith(draft());
      mockUpdateDraft.mockResolvedValue(null);
      await wrapper
        .findAll('[data-testid="draft-line-remove"]')[0]!
        .trigger('click');

      expect(await leaveGuards[0]!()).toBe(false);
    });

    it('does not hold up a read-only quotation', async () => {
      await mountWith(draft({ status: 'pending' }));

      expect(leaveGuards).toHaveLength(0);
    });
  });

  describe('deleting', () => {
    it('asks first, then deletes the draft and goes to the list', async () => {
      await mountWith(draft());
      mockDeleteDraft.mockResolvedValue(true);

      await find('quote-delete').trigger('click');
      expect(find('delete-dialog').attributes('data-name')).toBe(
        'Kontor plan 3',
      );
      await find('delete-confirm').trigger('click');
      await flushPromises();

      expect(mockDeleteDraft).toHaveBeenCalledWith('q-001');
      expect(navigateToMock).toHaveBeenCalledWith('/se/en/portal/quotations');
    });

    it('saves a waiting change before the delete', async () => {
      await mountWith(draft());
      geinsAnswers();
      mockDeleteDraft.mockResolvedValue(true);
      const order: string[] = [];
      mockUpdateDraft.mockImplementationOnce(async () => {
        order.push('save');
        return mockData.value!.quote;
      });
      mockDeleteDraft.mockImplementationOnce(async () => {
        order.push('delete');
        return true;
      });

      await wrapper
        .findAll('[data-testid="draft-line-more"]')[0]!
        .trigger('click');
      await find('quote-delete').trigger('click');
      await find('delete-confirm').trigger('click');
      await flushPromises();

      expect(order).toEqual(['save', 'delete']);
    });

    it('stays, with the dialog open, when the delete fails', async () => {
      await mountWith(draft());
      mockDeleteDraft.mockResolvedValue(false);

      await find('quote-delete').trigger('click');
      await find('delete-confirm').trigger('click');
      await flushPromises();

      expect(navigateToMock).not.toHaveBeenCalled();
      expect(find('delete-dialog').exists()).toBe(true);
    });
  });
});
