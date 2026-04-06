<script setup lang="ts">
import { Input } from '~/components/ui/input';
import { useQuotesStore } from '~/stores/quotes';
import type { QuoteStatus } from '#shared/types/quote';

definePageMeta({ middleware: 'auth' });

const { t } = useI18n();
const quotesStore = useQuotesStore();

const searchQuery = ref('');

onMounted(() => {
  quotesStore.fetchQuotes();
});

const filteredQuotes = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return quotesStore.quotes;
  return quotesStore.quotes.filter(
    (quote) =>
      quote.quoteNumber.toLowerCase().includes(q) ||
      quote.contactName.toLowerCase().includes(q),
  );
});

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function getStatusClasses(status: QuoteStatus): string {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-800';
    case 'accepted':
      return 'bg-green-100 text-green-800';
    case 'rejected':
      return 'bg-red-100 text-red-800';
    case 'expired':
    case 'cancelled':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function getStatusLabel(status: QuoteStatus): string {
  return t(`portal.quotations.status_${status}`);
}
</script>

<template>
  <PortalShell>
    <!-- Page header -->
    <div
      class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <h2 class="text-xl font-semibold">
        {{ t('portal.quotations.title') }}
      </h2>
      <!-- Search -->
      <Input
        v-model="searchQuery"
        type="search"
        data-testid="quotations-search"
        class="w-full sm:w-72"
        :placeholder="t('portal.quotations.search_placeholder')"
      />
    </div>

    <!-- Loading state -->
    <div
      v-if="quotesStore.isLoading"
      data-testid="quotations-loading"
      class="text-muted-foreground py-12 text-center text-sm"
    >
      {{ t('portal.quotations.title') }}...
    </div>

    <!-- Empty state -->
    <div
      v-else-if="filteredQuotes.length === 0"
      data-testid="quotations-empty"
      class="text-muted-foreground py-12 text-center text-sm"
    >
      {{ t('portal.quotations.no_quotations') }}
    </div>

    <!-- Quotations table -->
    <div v-else class="overflow-x-auto">
      <table data-testid="quotations-table" class="w-full text-sm">
        <thead>
          <tr class="border-border border-b text-left">
            <th class="py-3 pr-4 font-medium">
              {{ t('portal.quotations.quote_number') }}
            </th>
            <th class="py-3 pr-4 font-medium">
              {{ t('portal.quotations.created') }}
            </th>
            <th class="py-3 pr-4 font-medium">
              {{ t('portal.quotations.contact') }}
            </th>
            <th class="py-3 pr-4 font-medium">
              {{ t('portal.quotations.status') }}
            </th>
            <th class="py-3 pr-4 font-medium">
              {{ t('portal.quotations.total') }}
            </th>
            <th class="py-3 font-medium" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="quote in filteredQuotes"
            :key="quote.id"
            data-testid="quotation-row"
            class="border-border border-b"
          >
            <td class="py-3 pr-4 font-medium">{{ quote.quoteNumber }}</td>
            <td class="py-3 pr-4">{{ formatDate(quote.createdAt) }}</td>
            <td class="py-3 pr-4">{{ quote.contactName }}</td>
            <td class="py-3 pr-4">
              <span
                data-testid="quote-status-badge"
                class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                :class="getStatusClasses(quote.status)"
              >
                {{ getStatusLabel(quote.status) }}
              </span>
            </td>
            <td class="py-3 pr-4">{{ quote.totalFormatted }}</td>
            <td class="py-3">
              <NuxtLink
                :to="`/portal/quotations/${quote.id}`"
                data-testid="quotation-view-link"
                class="text-primary hover:text-primary/80 font-medium"
              >
                {{ t('portal.quotations.view') }}
              </NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </PortalShell>
</template>
