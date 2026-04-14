<script setup lang="ts">
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
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

function getStatusVariant(
  status: QuoteStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'accepted':
      return 'default';
    case 'rejected':
      return 'destructive';
    default:
      return 'secondary';
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
      <!-- Mobile card view -->
      <div class="space-y-3 md:hidden" data-testid="quotations-table">
        <NuxtLink
          v-for="quote in filteredQuotes"
          :key="quote.id"
          :to="localePath(`/portal/quotations/${quote.id}`)"
          data-testid="quotation-row"
          class="border-border hover:bg-muted/50 block rounded-lg border p-4 transition-colors"
        >
          <div class="mb-2 flex items-center justify-between">
            <span class="font-medium">{{ quote.quoteNumber }}</span>
            <Badge
              data-testid="quote-status-badge"
              :variant="getStatusVariant(quote.status)"
            >
              {{ getStatusLabel(quote.status) }}
            </Badge>
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
              v-for="quote in filteredQuotes"
              :key="quote.id"
              data-testid="quotation-row"
              class="border-border hover:bg-muted/50 border-b transition-colors"
            >
              <td class="py-3 pr-4">{{ quote.quoteNumber }}</td>
              <td class="py-3 pr-4">{{ formatDate(quote.createdAt) }}</td>
              <td class="py-3 pr-4">{{ quote.contactName }}</td>
              <td class="py-3 pr-4">{{ quote.totalFormatted }}</td>
              <td class="py-3 pr-4">
                <Badge
                  data-testid="quote-status-badge"
                  :variant="getStatusVariant(quote.status)"
                >
                  {{ getStatusLabel(quote.status) }}
                </Badge>
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
    </template>
  </PortalShell>
</template>
