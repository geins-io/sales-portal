import { defineStore } from 'pinia';
import type { Quote, QuoteListItem } from '#shared/types/quote';

export const useQuotesStore = defineStore('quotes', () => {
  const quotes = ref<QuoteListItem[]>([]);
  const totalQuotes = ref(0);
  const currentQuote = ref<Quote | null>(null);
  const isLoading = ref(false);
  const isActionLoading = ref(false);
  const error = ref<string | null>(null);

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
      const data = await $fetch<{ quotes: QuoteListItem[]; total: number }>(
        '/api/quotes',
        { query: { skip, take } },
      );
      quotes.value = data.quotes;
      totalQuotes.value = data.total;
    } catch {
      error.value = 'Failed to load quotes';
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchQuote(id: string) {
    isLoading.value = true;
    error.value = null;
    try {
      const data = await $fetch<{ quote: Quote }>(`/api/quotes/${id}`);
      currentQuote.value = data.quote;
    } catch {
      error.value = 'Failed to load quote';
    } finally {
      isLoading.value = false;
    }
  }

  async function acceptQuote(id: string) {
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
    } catch {
      error.value = 'portal.quotations.accept_failed';
    } finally {
      isActionLoading.value = false;
    }
  }

  async function rejectQuote(id: string) {
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
    } catch {
      error.value = 'portal.quotations.decline_failed';
    } finally {
      isActionLoading.value = false;
    }
  }

  function reset() {
    quotes.value = [];
    totalQuotes.value = 0;
    currentQuote.value = null;
    isLoading.value = false;
    isActionLoading.value = false;
    error.value = null;
  }

  return {
    quotes,
    totalQuotes,
    currentQuote,
    isLoading,
    isActionLoading,
    error,
    pendingQuotes,
    pendingCount,
    fetchQuotes,
    fetchQuote,
    acceptQuote,
    rejectQuote,
    reset,
  };
});
