<script setup lang="ts">
import { MoreHorizontal } from 'lucide-vue-next';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Input } from '~/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs';
import {
  QUOTE_LIST_FILTERS,
  getQuoteStatusLabelKey,
  getQuoteStatusVariant,
  isQuotePriceEstimate,
  quoteFilterOf,
  type QuoteListFilter,
} from '~/utils/quote-status';
import { quoteKindLabelKey } from '~/utils/quote-view';
import { useQuotesStore } from '~/stores/quotes';
import type { QuoteListItem } from '#shared/types/quote';

definePageMeta({ middleware: ['auth', 'feature'], feature: 'quotes' });

const { t } = useI18n();
const { formatLocale } = useFormatLocale();
const { timezone } = useTenant();
const { localePath } = useLocaleMarket();
const { showIncVat } = useVatDisplay();

function totalOf(quote: QuoteListItem): string {
  return showIncVat.value ? quote.totalFormatted : quote.totalExVatFormatted;
}

const { data, pending, error, refresh } = useFetch<{
  quotes: QuoteListItem[];
  total: number;
}>('/api/quotes', { dedupe: 'defer' });

// Drafts first; within each part the server's newest-first order holds.
const allQuotes = computed(() => {
  const quotes = data.value?.quotes ?? [];
  return [
    ...quotes.filter((quote) => quote.status === 'request_draft'),
    ...quotes.filter((quote) => quote.status !== 'request_draft'),
  ];
});

const filter = ref<QuoteListFilter>('all');
const searchQuery = ref('');

// A failed or pending read is not an empty one, so no count shows then.
const showCounts = computed(
  () => !pending.value && !error.value && data.value != null,
);

const counts = computed(() => {
  const c = {
    all: allQuotes.value.length,
    drafts: 0,
    requests: 0,
    quotations: 0,
  };
  for (const quote of allQuotes.value) c[quoteFilterOf(quote.status)]++;
  return c;
});

const filteredQuotes = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return allQuotes.value.filter(
    (quote) =>
      (filter.value === 'all' ||
        quoteFilterOf(quote.status) === filter.value) &&
      (!q ||
        (quote.name ?? '').toLowerCase().includes(q) ||
        quote.quoteNumber.toLowerCase().includes(q)),
  );
});

function nameOf(quote: QuoteListItem): string {
  return quote.name || quote.quoteNumber || '—';
}

/** "Offertförfrågan", "Offertförfrågan · 2401-1-0001-00", "Offert · 2401-1-0001-00". */
function kindLine(quote: QuoteListItem): string {
  const kind = t(quoteKindLabelKey(quote.status));
  return quote.quoteNumber ? `${kind} · ${quote.quoteNumber}` : kind;
}

// ------------------------------------------------------------ the drafts
// The list follows each write's answer rather than reading the list again.
const store = useQuotesStore();
/** The store's error from a write made here, never one left by another page. */
const writeError = ref<string | null>(null);

const { canRequestQuotes } = useFeatureAccess();
/** A draft the buyer may work on; without quote requests it is only viewed. */
const editableDraft = (quote: QuoteListItem) =>
  quote.status === 'request_draft' && canRequestQuotes();

function quotePath(quote: QuoteListItem): string {
  return localePath(`/portal/quotations/${quote.id}`);
}

const renameRow = ref<QuoteListItem | null>(null);
const renameOpen = computed({
  get: () => renameRow.value !== null,
  set: (open: boolean) => {
    if (!open) renameRow.value = null;
  },
});

async function submitRename(name: string) {
  const row = renameRow.value;
  if (!row) return;
  const answer = await store.updateDraft(row.id, { name });
  if (!answer) {
    writeError.value = store.error;
    return;
  }
  writeError.value = null;
  if (data.value) {
    data.value = {
      ...data.value,
      quotes: data.value.quotes.map((quote) =>
        quote.id === row.id ? { ...quote, name: answer.name } : quote,
      ),
    };
  }
  renameRow.value = null;
}

const deleteRow = ref<QuoteListItem | null>(null);
const deleteOpen = computed({
  get: () => deleteRow.value !== null,
  set: (open: boolean) => {
    if (!open) deleteRow.value = null;
  },
});

async function confirmDelete() {
  const row = deleteRow.value;
  if (!row) return;
  if (!(await store.deleteDraft(row.id))) {
    writeError.value = store.error;
    return;
  }
  writeError.value = null;
  if (data.value) {
    data.value = {
      quotes: data.value.quotes.filter((quote) => quote.id !== row.id),
      total: data.value.total - 1,
    };
  }
  deleteRow.value = null;
}

const emptyText = computed(() =>
  searchQuery.value.trim()
    ? t('portal.quotations.empty.no_match')
    : t(`portal.quotations.empty.${filter.value}`),
);

const {
  currentPage,
  totalPages,
  paginatedItems: paginatedQuotes,
  showPagination,
  goToPage,
} = usePagination<QuoteListItem>({
  source: () => filteredQuotes.value,
  pageSize: 20,
  resetOn: [() => searchQuery.value, () => filter.value],
});

const paginationSummary = usePaginationSummary(
  computed(() => paginatedQuotes.value.length),
  computed(() => filteredQuotes.value.length),
  'quotes',
);

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(formatLocale.value, {
      ...(timezone.value ? { timeZone: timezone.value } : {}),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return dateStr;
  }
}
</script>

<template>
  <PortalShell>
    <div class="border-border rounded-lg border bg-white p-6">
      <!-- Page header -->
      <div
        class="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
      >
        <div>
          <h2 class="text-2xl font-semibold">
            {{ t('portal.quotations.title') }}
          </h2>
          <p class="text-muted-foreground mt-1 text-sm">
            {{ t('portal.quotations.subtitle') }}
          </p>
        </div>
        <Input
          v-model="searchQuery"
          type="search"
          data-testid="quotations-search"
          class="w-full md:w-72"
          :placeholder="t('portal.quotations.search_placeholder')"
          :aria-label="t('portal.quotations.search_placeholder')"
        />
      </div>

      <!-- Tabs -->
      <Tabs v-model="filter" class="mb-8">
        <TabsList
          variant="underline"
          data-testid="quotations-filter"
          class="overflow-x-auto"
        >
          <TabsTrigger
            v-for="f in QUOTE_LIST_FILTERS"
            :key="f"
            :value="f"
            :data-testid="`quotations-filter-${f}`"
          >
            {{ t(`portal.quotations.filters.${f}`) }}
            <span
              v-if="showCounts"
              :data-testid="`quotations-filter-count-${f}`"
              class="text-muted-foreground ml-1 font-normal tabular-nums"
              >{{ counts[f] }}</span
            >
          </TabsTrigger>
        </TabsList>
      </Tabs>

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
        class="border-border flex flex-col items-center rounded-lg border border-dashed px-6 py-12 text-center"
      >
        <p class="text-muted-foreground text-sm">{{ emptyText }}</p>
      </div>

      <!-- One handle for the list, wrapping both responsive shapes below. It
           sits on the `v-else` rather than around the whole block so its
           presence still means "the list has rows" — a wrapper that also
           covered the empty state would match on an empty tenant and assert
           nothing. -->
      <div v-else data-testid="quotations-table">
        <!-- Count summary -->
        <p
          data-testid="quotations-count"
          :data-shown="paginatedQuotes.length"
          :data-total="filteredQuotes.length"
          class="text-muted-foreground mb-3 text-sm"
        >
          {{ paginationSummary }}
        </p>

        <!-- Mobile card view -->
        <div class="space-y-3 md:hidden">
          <div
            v-for="quote in paginatedQuotes"
            :key="quote.id"
            data-testid="quotation-card"
            class="border-border rounded-lg border p-4"
          >
            <NuxtLink
              :to="quotePath(quote)"
              data-testid="quotation-row"
              class="block"
            >
              <div class="mb-2 flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="truncate font-medium">{{ nameOf(quote) }}</p>
                  <p
                    data-testid="quotation-kind"
                    class="text-muted-foreground text-xs"
                  >
                    {{ kindLine(quote) }}
                  </p>
                </div>
                <Badge
                  data-testid="quote-status-badge"
                  :variant="getQuoteStatusVariant(quote.status)"
                >
                  {{ t(getQuoteStatusLabelKey(quote.status)) }}
                </Badge>
              </div>
              <div class="text-muted-foreground space-y-1 text-sm">
                <div class="flex justify-between">
                  <span>{{ formatDate(quote.createdAt) }}</span>
                  <span class="text-foreground font-medium tabular-nums"
                    >{{ isQuotePriceEstimate(quote.status) ? '≈ ' : ''
                    }}<span data-testid="quotation-total">{{
                      totalOf(quote)
                    }}</span></span
                  >
                </div>
                <div>{{ quote.contactName }}</div>
              </div>
            </NuxtLink>
            <div
              v-if="editableDraft(quote)"
              class="mt-3 flex items-center gap-2"
            >
              <Button as-child variant="outline" size="sm" class="ml-auto">
                <NuxtLink
                  :to="quotePath(quote)"
                  data-testid="quotation-card-continue"
                >
                  {{ t('portal.quotations.continue') }}
                </NuxtLink>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                data-testid="quotation-card-rename"
                @click="renameRow = quote"
              >
                {{ t('portal.quotations.draft.rename') }}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                class="text-destructive"
                data-testid="quotation-card-delete"
                @click="deleteRow = quote"
              >
                {{ t('portal.quotations.draft.delete') }}
              </Button>
            </div>
          </div>
        </div>

        <!-- Desktop table -->
        <div class="hidden md:block">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-border border-b text-left">
                <th class="py-3 pr-4 font-medium">
                  {{ t('portal.quotations.name_number') }}
                </th>
                <th class="py-3 pr-4 font-medium">
                  {{ t('portal.quotations.created') }}
                </th>
                <th class="py-3 pr-4 font-medium">
                  {{ t('portal.quotations.contact') }}
                </th>
                <th class="py-3 pr-4 text-right font-medium">
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
                :data-id="quote.id"
                class="border-border hover:bg-muted/50 border-b transition-colors"
              >
                <td class="py-3 pr-4">
                  <NuxtLink
                    :to="quotePath(quote)"
                    data-testid="quotation-name"
                    class="font-medium hover:underline"
                  >
                    {{ nameOf(quote) }}
                  </NuxtLink>
                  <p
                    data-testid="quotation-kind"
                    class="text-muted-foreground text-xs"
                  >
                    {{ kindLine(quote) }}
                  </p>
                </td>
                <td class="py-3 pr-4">{{ formatDate(quote.createdAt) }}</td>
                <td class="py-3 pr-4">{{ quote.contactName }}</td>
                <td class="py-3 pr-4 text-right whitespace-nowrap">
                  <span data-testid="quotation-total" class="tabular-nums">{{
                    totalOf(quote)
                  }}</span>
                  <span
                    v-if="isQuotePriceEstimate(quote.status)"
                    data-testid="quotation-estimate"
                    class="text-muted-foreground block text-xs"
                  >
                    {{ t('portal.quotations.estimate_short') }}
                  </span>
                </td>
                <td class="py-3 pr-4">
                  <Badge
                    data-testid="quote-status-badge"
                    :variant="getQuoteStatusVariant(quote.status)"
                  >
                    {{ t(getQuoteStatusLabelKey(quote.status)) }}
                  </Badge>
                </td>
                <td class="py-3 text-right">
                  <div
                    v-if="editableDraft(quote)"
                    class="flex items-center justify-end gap-1"
                  >
                    <PortalRowAction
                      :to="quotePath(quote)"
                      :label="t('portal.quotations.continue')"
                      testid="quotation-continue"
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger as-child>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          data-testid="quotation-more"
                          :aria-label="
                            t('portal.quotations.draft.more', {
                              name: nameOf(quote),
                            })
                          "
                        >
                          <MoreHorizontal class="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          data-testid="quotation-rename"
                          @select="renameRow = quote"
                        >
                          {{ t('portal.quotations.draft.rename') }}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          data-testid="quotation-delete"
                          @select="deleteRow = quote"
                        >
                          {{ t('portal.quotations.draft.delete') }}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <PortalRowAction
                    v-else
                    :to="quotePath(quote)"
                    :label="t('portal.quotations.view')"
                    testid="quotation-view-link"
                  />
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
      </div>

      <p
        v-if="writeError"
        role="alert"
        data-testid="quotations-write-error"
        class="text-destructive mt-4 text-sm"
      >
        {{ t(writeError) }}
      </p>
    </div>

    <PortalDialogRenameQuoteDraft
      v-model:open="renameOpen"
      :name="renameRow?.name ?? ''"
      :pending="store.isSaving"
      @submit="submitRename"
    />
    <PortalDialogDeleteQuoteDraft
      v-model:open="deleteOpen"
      :name="deleteRow ? nameOf(deleteRow) : ''"
      :pending="store.isSaving"
      @confirm="confirmDelete"
    />
  </PortalShell>
</template>
