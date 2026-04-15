<script setup lang="ts">
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { getQuoteStatusPillClass } from '~/utils/quote-status';
import type { QuoteListItem, QuoteStatus } from '#shared/types/quote';

definePageMeta({ middleware: 'auth' });

const { t, locale } = useI18n();
const { localePath } = useLocaleMarket();

const { data, pending, error, refresh } = useFetch<{
  quotes: QuoteListItem[];
  total: number;
}>('/api/quotes', { dedupe: 'defer' });

const allQuotes = computed(() => data.value?.quotes ?? []);

const searchQuery = ref('');

const filteredQuotes = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return allQuotes.value;
  return allQuotes.value.filter(
    (quote) =>
      quote.quoteNumber.toLowerCase().includes(q) ||
      quote.contactName.toLowerCase().includes(q),
  );
});

const {
  currentPage,
  totalPages,
  paginatedItems: paginatedQuotes,
  showPagination,
  goToPage,
} = usePagination<QuoteListItem>({
  source: () => filteredQuotes.value,
  pageSize: 20,
  resetOn: [() => searchQuery.value],
});

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(locale.value, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return dateStr;
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
      class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
    >
      <div>
        <h2 class="text-xl font-semibold">
          {{ t('portal.quotations.title') }}
        </h2>
        <p class="text-muted-foreground mt-1 text-sm">
          {{ t('portal.quotations.subtitle') }}
        </p>
      </div>
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
      v-if="pending"
      data-testid="quotations-loading"
      class="text-muted-foreground py-12 text-center text-sm"
    >
      {{ t('portal.quotations.title') }}...
    </div>

    <!-- Error state -->
    <div
      v-else-if="error"
      data-testid="quotations-error"
      class="py-12 text-center"
    >
      <p class="text-muted-foreground mb-4 text-sm">
        {{ t('portal.quotations.error_loading') }}
      </p>
      <Button
        data-testid="quotations-retry"
        variant="link"
        size="sm"
        @click="refresh()"
      >
        {{ t('portal.quotations.retry') }}
      </Button>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="filteredQuotes.length === 0"
      data-testid="quotations-empty"
      class="text-muted-foreground py-12 text-center text-sm"
    >
      {{ t('portal.quotations.no_quotations') }}
    </div>

    <template v-else>
      <!-- Count summary -->
      <p
        data-testid="quotations-count"
        :data-shown="paginatedQuotes.length"
        :data-total="filteredQuotes.length"
        class="text-muted-foreground mb-3 text-sm"
      >
        {{
          t('portal.quotations.count_summary', {
            shown: paginatedQuotes.length,
            total: filteredQuotes.length,
          })
        }}
      </p>

      <!-- Mobile card view -->
      <div class="space-y-3 md:hidden" data-testid="quotations-table">
        <NuxtLink
          v-for="quote in paginatedQuotes"
          :key="quote.id"
          :to="localePath(`/portal/quotations/${quote.id}`)"
          data-testid="quotation-row"
          class="border-border hover:bg-muted/50 block rounded-lg border p-4 transition-colors"
        >
          <div class="mb-2 flex items-center justify-between">
            <span class="font-medium">{{ quote.quoteNumber }}</span>
            <span
              data-testid="quote-status-badge"
              class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
              :class="getQuoteStatusPillClass(quote.status)"
            >
              {{ getStatusLabel(quote.status) }}
            </span>
          </div>
          <div class="text-muted-foreground space-y-1 text-sm">
            <div class="flex justify-between">
              <span>{{ formatDate(quote.createdAt) }}</span>
              <span class="text-foreground font-medium">{{
                quote.totalFormatted
              }}</span>
            </div>
            <div>{{ quote.contactName }}</div>
          </div>
        </NuxtLink>
      </div>

      <!-- Desktop table -->
      <div class="hidden overflow-x-auto md:block">
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
                {{ t('portal.quotations.total') }}
              </th>
              <th class="py-3 pr-4 font-medium">
                {{ t('portal.quotations.status') }}
              </th>
              <th class="py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="quote in paginatedQuotes"
              :key="quote.id"
              data-testid="quotation-row"
              class="border-border hover:bg-muted/50 border-b transition-colors"
            >
              <td class="py-3 pr-4">{{ quote.quoteNumber }}</td>
              <td class="py-3 pr-4">{{ formatDate(quote.createdAt) }}</td>
              <td class="py-3 pr-4">{{ quote.contactName }}</td>
              <td class="py-3 pr-4">{{ quote.totalFormatted }}</td>
              <td class="py-3 pr-4">
                <span
                  data-testid="quote-status-badge"
                  class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
                  :class="getQuoteStatusPillClass(quote.status)"
                >
                  {{ getStatusLabel(quote.status) }}
                </span>
              </td>
              <td class="py-3">
                <NuxtLink
                  :to="localePath(`/portal/quotations/${quote.id}`)"
                  data-testid="quotation-view-link"
                  class="text-primary hover:text-primary/80 text-sm font-medium"
                >
                  {{ t('portal.quotations.view') }}
                </NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div
        v-if="showPagination"
        data-testid="quotations-pagination"
        class="mt-4 flex items-center justify-end gap-2"
      >
        <Button
          data-testid="quotations-previous"
          variant="ghost"
          size="sm"
          :disabled="currentPage <= 1"
          @click="goToPage(currentPage - 1)"
        >
          {{ t('portal.quotations.pagination.previous') }}
        </Button>
        <template v-for="page in totalPages" :key="page">
          <Button
            v-if="
              page === 1 ||
              page === totalPages ||
              Math.abs(page - currentPage) <= 1
            "
            :variant="page === currentPage ? 'default' : 'ghost'"
            size="sm"
            @click="goToPage(page)"
          >
            {{ page }}
          </Button>
          <span
            v-else-if="
              page === 2 && currentPage > 3
                ? true
                : page === totalPages - 1 && currentPage < totalPages - 2
            "
            class="text-muted-foreground px-1"
            >...</span
          >
        </template>
        <Button
          data-testid="quotations-next"
          variant="ghost"
          size="sm"
          :disabled="currentPage >= totalPages"
          @click="goToPage(currentPage + 1)"
        >
          {{ t('portal.quotations.pagination.next') }}
        </Button>
      </div>
    </template>
  </PortalShell>
</template>
