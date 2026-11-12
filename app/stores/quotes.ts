import { defineStore } from 'pinia';
import type {
  Quote,
  QuoteListItem,
  QuoteRequestDetails,
  QuoteRequestUpdate,
} from '#shared/types/quote';
import { internalFetch } from '~/utils/internal-fetch';
import { useAuthStore } from '~/stores/auth';

/**
 * How long the page waits for a draft write. Geins finishes a write it got
 * (the server does not cut it), but a page left waiting would keep "Saving…"
 * up and hold every later change and the way out.
 */
export const DRAFT_WRITE_TIMEOUT_MS = 20_000;

/** What an add to a draft from a product page came to. */
export type QuoteAddOutcome =
  | { kind: 'added'; id: string; name: string; created: boolean }
  | { kind: 'failed' };

export const useQuotesStore = defineStore('quotes', () => {
  const quotes = ref<QuoteListItem[]>([]);
  const totalQuotes = ref(0);
  const currentQuote = ref<Quote | null>(null);
  const isLoading = ref(false);
  const isActionLoading = ref(false);
  /** A write to a draft (its name or lines) or its delete is under way. */
  const isSaving = ref(false);
  const error = ref<string | null>(null);
  /**
   * The last add from a product page, by the page that made it. Kept here
   * rather than in the menu: the configurator takes the menu off the page
   * while it restores the session after the add.
   */
  const lastAdd = ref<{ scope: string; outcome: QuoteAddOutcome } | null>(null);

  // Computeds
  const pendingQuotes = computed<QuoteListItem[]>(() =>
    quotes.value.filter((q) => q.status === 'pending'),
  );
  const pendingCount = computed(() => pendingQuotes.value.length);

  // Actions
  async function fetchQuotes(skip?: number, take?: number) {
    isLoading.value = true;
    error.value = null;
    try {
      const data = await internalFetch<{
        quotes: QuoteListItem[];
        total: number;
      }>('/api/quotes', { query: { skip, take } });
      quotes.value = data.quotes;
      totalQuotes.value = data.total;
    } catch {
      error.value = 'portal.quotations.error_loading';
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchQuote(id: string) {
    isLoading.value = true;
    error.value = null;
    try {
      const data = await internalFetch<{ quote: Quote }>(`/api/quotes/${id}`);
      currentQuote.value = data.quote;
    } catch {
      error.value = 'portal.quotations.load_failed';
    } finally {
      isLoading.value = false;
    }
  }

  async function acceptQuote(id: string): Promise<Quote | null> {
    isActionLoading.value = true;
    error.value = null;
    try {
      const data = await $fetch<{ quote: Quote }>(`/api/quotes/${id}/accept`, {
        method: 'POST',
      });
      currentQuote.value = data.quote;
      const idx = quotes.value.findIndex((q) => q.id === id);
      if (idx >= 0) {
        quotes.value[idx] = {
          ...quotes.value[idx]!,
          status: data.quote.status,
        };
      }
      return data.quote;
    } catch {
      error.value = 'portal.quotations.accept_failed';
      return null;
    } finally {
      isActionLoading.value = false;
    }
  }

  async function rejectQuote(id: string): Promise<Quote | null> {
    isActionLoading.value = true;
    error.value = null;
    try {
      const data = await $fetch<{ quote: Quote }>(`/api/quotes/${id}/reject`, {
        method: 'POST',
      });
      currentQuote.value = data.quote;
      const idx = quotes.value.findIndex((q) => q.id === id);
      if (idx >= 0) {
        quotes.value[idx] = {
          ...quotes.value[idx]!,
          status: data.quote.status,
        };
      }
      return data.quote;
    } catch {
      error.value = 'portal.quotations.decline_failed';
      return null;
    } finally {
      isActionLoading.value = false;
    }
  }

  /** Places the order; a message, even an empty one, is written first. */
  async function finalizeQuote(
    id: string,
    message?: string,
  ): Promise<Quote | null> {
    isActionLoading.value = true;
    error.value = null;
    try {
      const data = await $fetch<{ quote: Quote }>(
        `/api/quotes/${id}/finalize`,
        message === undefined
          ? { method: 'POST' }
          : { method: 'POST', body: { message: message.trim() } },
      );
      currentQuote.value = data.quote;
      const idx = quotes.value.findIndex((q) => q.id === id);
      if (idx >= 0) {
        quotes.value[idx] = {
          ...quotes.value[idx]!,
          status: data.quote.status,
        };
      }
      return data.quote;
    } catch {
      error.value = 'portal.quotations.order.failed';
      return null;
    } finally {
      isActionLoading.value = false;
    }
  }

  /** One write to a draft; the answer is the draft as Geins now holds it. */
  async function updateDraft(
    id: string,
    update: QuoteRequestUpdate,
  ): Promise<Quote | null> {
    isSaving.value = true;
    try {
      const data = await $fetch<{ quote: Quote }>(`/api/quotes/${id}/request`, {
        method: 'PATCH',
        body: update,
        timeout: DRAFT_WRITE_TIMEOUT_MS,
      });
      error.value = null;
      return data.quote;
    } catch {
      error.value = 'portal.quotations.draft.save_failed';
      return null;
    } finally {
      isSaving.value = false;
    }
  }

  async function deleteDraft(id: string): Promise<boolean> {
    isSaving.value = true;
    try {
      await $fetch(`/api/quotes/${id}`, {
        method: 'DELETE',
        timeout: DRAFT_WRITE_TIMEOUT_MS,
      });
      error.value = null;
      const before = quotes.value.length;
      quotes.value = quotes.value.filter((q) => q.id !== id);
      totalQuotes.value -= before - quotes.value.length;
      return true;
    } catch {
      error.value = 'portal.quotations.draft.delete_failed';
      return false;
    } finally {
      isSaving.value = false;
    }
  }

  /** Writes the request's details, if any, then sends it to the seller. */
  async function sendQuoteRequest(
    id: string,
    details: QuoteRequestDetails,
  ): Promise<Quote | null> {
    isActionLoading.value = true;
    error.value = null;
    try {
      const body = Object.fromEntries(
        Object.entries(details).filter(([, value]) => value),
      );
      if (Object.keys(body).length) {
        await $fetch(`/api/quotes/${id}/request`, { method: 'PATCH', body });
      }
      const data = await $fetch<{ quote: Quote }>(`/api/quotes/${id}/release`, {
        method: 'POST',
      });
      currentQuote.value = data.quote;
      const idx = quotes.value.findIndex((q) => q.id === id);
      if (idx >= 0) {
        quotes.value[idx] = {
          ...quotes.value[idx]!,
          status: data.quote.status,
        };
      }
      return data.quote;
    } catch {
      error.value = 'portal.quotations.request.send_failed';
      return null;
    } finally {
      isActionLoading.value = false;
    }
  }

  /** The page that owns `scope` is gone or shows another product. */
  function forgetAdd(scope: string) {
    if (lastAdd.value?.scope === scope) lastAdd.value = null;
  }

  function reset() {
    quotes.value = [];
    totalQuotes.value = 0;
    currentQuote.value = null;
    isLoading.value = false;
    isActionLoading.value = false;
    isSaving.value = false;
    error.value = null;
    lastAdd.value = null;
  }

  // Everything here is the signed-in buyer's: another buyer, or none, starts
  // empty in the same tab.
  const auth = useAuthStore();
  watch(
    () => auth.user?.userId ?? null,
    (now, before) => {
      if (now !== before) reset();
    },
  );

  return {
    quotes,
    totalQuotes,
    currentQuote,
    isLoading,
    isActionLoading,
    isSaving,
    error,
    lastAdd,
    forgetAdd,
    pendingQuotes,
    pendingCount,
    fetchQuotes,
    fetchQuote,
    acceptQuote,
    rejectQuote,
    finalizeQuote,
    sendQuoteRequest,
    updateDraft,
    deleteDraft,
    reset,
  };
});
