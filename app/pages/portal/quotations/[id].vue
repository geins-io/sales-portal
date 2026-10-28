<script setup lang="ts">
import type { FunctionalComponent } from 'vue';
import {
  ArrowLeft,
  Calendar,
  CalendarPlus,
  CircleCheck,
  Clock,
  FileText,
  Info,
  User,
} from 'lucide-vue-next';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion';
import { useQuotesStore } from '~/stores/quotes';
import {
  getQuoteStatusLabelKey,
  getQuoteStatusVariant,
} from '~/utils/quote-status';
import {
  quoteAcceptKind,
  quoteAmounts,
  quoteKindLabelKey,
  quoteResponses,
  quoteStatusInfoKey,
  quoteSummaryRows,
} from '~/utils/quote-view';
import type { Quote, QuoteLineItem } from '#shared/types/quote';
import { productPath } from '#shared/utils/route-helpers';

definePageMeta({ middleware: ['auth', 'feature'], feature: 'quotes' });

const { t } = useI18n();
const { formatLocale } = useFormatLocale();
const { timezone } = useTenant();
const route = useRoute();
const store = useQuotesStore();
const { localePath } = useLocaleMarket();
const { showIncVat } = useVatDisplay();

const quoteId = computed(() => route.params.id as string);

// SSR-safe 404: fetch at top-level setup so Nuxt can set the response status
// before the HTML is streamed. Sibling routes (accept/reject) under
// /api/quotes/[id] can cause union inference, so explicitly type the generic.
const { data, error } = await useFetch<{ quote: Quote }>(
  () => `/api/quotes/${quoteId.value}`,
  { dedupe: 'defer' },
);

if (error.value || !data.value?.quote) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Quotation not found',
    fatal: true,
  });
}

// Seed the Pinia store so accept/reject mutations have the latest snapshot.
// Clear any stale error from a previous route so the banner starts hidden.
store.currentQuote = data.value.quote;
store.error = null;

const quote = computed<Quote | null>(() => data.value?.quote ?? null);

useHead({
  title: computed(
    () =>
      quote.value?.name ??
      `${t('portal.quotations.detail_title')} #${quote.value?.quoteNumber ?? ''}`,
  ),
});

// ------------------------------------------------------- buyer responses
const responses = computed(() =>
  quoteResponses(quote.value?.status ?? 'unknown'),
);
const acceptKind = computed(() =>
  quote.value ? quoteAcceptKind(quote.value) : 'plain',
);

type QuoteAction = 'withdraw' | 'decline' | 'accept';
const pendingAction = ref<QuoteAction | null>(null);
const actionOpen = computed({
  get: () => pendingAction.value !== null,
  set: (open: boolean) => {
    if (!open) pendingAction.value = null;
  },
});

const actionCopy = computed(() => {
  const action = pendingAction.value;
  if (!action) return null;
  const key = action === 'accept' ? `accept_${acceptKind.value}` : action;
  return {
    title: t(`portal.quotations.${key}_title`),
    description: t(`portal.quotations.${key}_body`),
    confirm: t(`portal.quotations.${key}`),
    destructive: action !== 'accept',
  };
});

// The page renders from `data`, so an answered quotation is written back there.
async function runAction() {
  const action = pendingAction.value;
  if (!quote.value || !action) return;
  const answered =
    action === 'accept'
      ? await store.acceptQuote(quote.value.id)
      : await store.rejectQuote(quote.value.id);
  pendingAction.value = null;
  if (answered) data.value = { quote: answered };
}

// ------------------------------------------------------------------ view
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(formatLocale.value, {
    ...(timezone.value ? { timeZone: timezone.value } : {}),
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Every amount is the side of the buyer's VAT choice; VAT itself is one number.
function unitPriceOf(item: QuoteLineItem): string {
  return showIncVat.value
    ? item.unitPriceFormatted
    : item.unitPriceExVatFormatted;
}

function totalPriceOf(item: QuoteLineItem): string {
  return showIncVat.value
    ? item.totalPriceFormatted
    : item.totalPriceExVatFormatted;
}

const amounts = computed(() =>
  quoteAmounts(quote.value, showIncVat.value, formatLocale.value),
);

const summaryRows = computed(() =>
  quoteSummaryRows(
    amounts.value,
    quote.value?.lineItems?.length ?? 0,
    showIncVat.value,
    t,
  ),
);

interface MetaRow {
  key: string;
  testId: string;
  icon: FunctionalComponent;
  label: string;
  lines: string[];
}

/** The details card: only the rows that have a value, in the prototype's order. */
const metaRows = computed<MetaRow[]>(() => {
  const q = quote.value;
  if (!q) return [];
  const rows: MetaRow[] = [];
  const add = (row: MetaRow) => {
    const lines = row.lines.filter(Boolean);
    if (lines.length) rows.push({ ...row, lines });
  };
  add({
    key: 'reference',
    testId: 'quote-reference',
    icon: FileText,
    label: t('portal.quotations.quotation_reference'),
    lines: q.quoteNumber ? [`REF: ${q.quoteNumber}`] : [],
  });
  add({
    key: 'created',
    testId: 'quote-meta-created',
    icon: CalendarPlus,
    label: t('portal.quotations.created_at'),
    lines: q.createdAt ? [formatDate(q.createdAt)] : [],
  });
  const infoKey = quoteStatusInfoKey(q);
  add({
    key: 'status',
    testId: 'quote-meta-status',
    icon: Info,
    label: t('portal.quotations.status_label'),
    lines: infoKey ? [t(infoKey)] : [],
  });
  add({
    key: 'expires',
    testId: 'expires-at',
    icon: Calendar,
    label: t('portal.quotations.expires_at'),
    lines: q.expiresAt ? [formatDate(q.expiresAt)] : [],
  });
  add({
    key: 'terms',
    testId: 'payment-terms',
    icon: Clock,
    label: t('portal.quotations.payment_terms'),
    lines: [q.paymentTerms ?? ''],
  });
  add({
    key: 'accepted',
    testId: 'quote-meta-accepted',
    icon: CircleCheck,
    label: t('portal.quotations.accepted_at'),
    lines: q.acceptedAt ? [formatDate(q.acceptedAt), q.acceptedBy ?? ''] : [],
  });
  add({
    key: 'contact',
    testId: 'sale-contact',
    icon: User,
    label: t('portal.quotations.sale_contact'),
    lines: q.seller ? [q.seller.name, q.seller.phone ?? ''] : [],
  });
  return rows;
});

const hasCustomerCard = computed(
  () =>
    !!(
      quote.value?.company ||
      quote.value?.billingAddress ||
      quote.value?.shippingAddress
    ),
);

/** One line for the collapsed customer card: company · delivery address. */
const customerSummary = computed(() => {
  const q = quote.value;
  const ship = q?.shippingAddress;
  const where = ship
    ? [ship.addressLine1, ship.city].filter(Boolean).join(', ')
    : '';
  return [
    q?.company?.name,
    where && t('portal.quotations.delivery_short', { address: where }),
  ]
    .filter(Boolean)
    .join(' · ');
});
</script>

<template>
  <PortalShell>
    <div
      v-if="quote"
      data-testid="quote-detail"
      class="border-border rounded-lg border bg-white p-6"
    >
      <div
        class="border-border flex flex-wrap items-center justify-between gap-4 border-b pb-4"
      >
        <NuxtLink
          data-testid="back-link"
          :to="localePath('/portal/quotations')"
          class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft class="size-4" />
          {{ t('portal.quotations.back_to_quotations') }}
        </NuxtLink>
      </div>

      <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <!-- Left: the lines, a table on desktop and cards below md -->
        <div class="order-2 min-w-0 space-y-4 lg:order-1 lg:col-span-2">
          <h3 class="text-base font-semibold">
            {{ t('portal.quotations.items_heading') }}
          </h3>

          <div data-testid="line-items-desktop" class="hidden md:block">
            <table data-testid="line-items-table" class="w-full text-sm">
              <thead class="bg-muted/50">
                <tr>
                  <th class="px-3 py-3 text-left font-medium">
                    {{ t('portal.quotations.product') }}
                  </th>
                  <th class="px-3 py-3 text-left font-medium">
                    {{ t('product.article_number_heading') }}
                  </th>
                  <th class="px-3 py-3 text-right font-medium">
                    {{ t('portal.quotations.quantity') }}
                  </th>
                  <th class="px-3 py-3 text-right font-medium">
                    {{ t('portal.quotations.unit_price') }}
                  </th>
                  <th class="px-3 py-3 text-right font-medium">
                    {{ t('portal.quotations.line_total') }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-border border-border divide-y border-b">
                <tr
                  v-for="item in quote.lineItems"
                  :key="item.sku"
                  data-testid="line-item-row"
                >
                  <td class="px-3 py-3">
                    <div class="flex items-center gap-3">
                      <ProductThumbnail
                        :file-name="item.imageFileName"
                        :url="item.imageUrl"
                        :alt="item.name"
                      />
                      <NuxtLink
                        v-if="item.alias"
                        :to="localePath(productPath(item.alias))"
                        data-testid="line-item-name-link"
                        class="font-medium hover:underline"
                      >
                        {{ item.name }}
                      </NuxtLink>
                      <span
                        v-else
                        data-testid="line-item-name"
                        class="font-medium"
                        >{{ item.name }}</span
                      >
                    </div>
                  </td>
                  <td class="text-muted-foreground px-3 py-3 whitespace-nowrap">
                    {{ item.articleNumber }}
                  </td>
                  <td
                    data-testid="line-item-quantity"
                    class="px-3 py-3 text-right tabular-nums"
                  >
                    {{ item.quantity }}
                  </td>
                  <td
                    data-testid="line-item-unit-price"
                    class="px-3 py-3 text-right whitespace-nowrap tabular-nums"
                  >
                    {{ unitPriceOf(item) }}
                  </td>
                  <td
                    data-testid="line-item-total-price"
                    class="px-3 py-3 text-right font-medium whitespace-nowrap tabular-nums"
                  >
                    {{ totalPriceOf(item) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <ul
            data-testid="line-item-cards"
            class="divide-border border-border divide-y border-b md:hidden"
          >
            <li
              v-for="item in quote.lineItems"
              :key="item.sku"
              data-testid="line-item-card"
              class="flex gap-3 py-4"
            >
              <ProductThumbnail
                :file-name="item.imageFileName"
                :url="item.imageUrl"
                :alt="item.name"
                size="size-14"
              />
              <div class="min-w-0 flex-1 space-y-2">
                <div>
                  <NuxtLink
                    v-if="item.alias"
                    :to="localePath(productPath(item.alias))"
                    data-testid="line-item-name-link"
                    class="text-sm font-medium hover:underline"
                  >
                    {{ item.name }}
                  </NuxtLink>
                  <span
                    v-else
                    data-testid="line-item-name"
                    class="text-sm font-medium"
                    >{{ item.name }}</span
                  >
                  <p
                    v-if="item.articleNumber"
                    class="text-muted-foreground text-xs"
                  >
                    {{ item.articleNumber }}
                  </p>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <span class="text-muted-foreground text-sm tabular-nums">
                    <span data-testid="line-item-card-quantity">{{
                      item.quantity
                    }}</span>
                    ×
                    <span data-testid="line-item-card-unit-price">{{
                      unitPriceOf(item)
                    }}</span>
                  </span>
                  <span
                    data-testid="line-item-card-total-price"
                    class="text-sm font-medium tabular-nums"
                    >{{ totalPriceOf(item) }}</span
                  >
                </div>
              </div>
            </li>
          </ul>
        </div>

        <!-- Right: header, summary with the responses, details, customer -->
        <aside class="order-1 space-y-6 lg:order-2">
          <header data-testid="quote-header">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <h2
                  data-testid="quote-title"
                  class="text-2xl font-semibold break-words"
                >
                  {{
                    quote.name ??
                    `${t('portal.quotations.detail_title')} #${quote.quoteNumber}`
                  }}
                </h2>
                <p
                  data-testid="quote-kind"
                  class="text-muted-foreground mt-1 text-xs font-medium tracking-wider uppercase"
                >
                  {{ t(quoteKindLabelKey(quote.status))
                  }}<template v-if="quote.quoteNumber">
                    · {{ quote.quoteNumber }}</template
                  >
                </p>
              </div>
              <Badge
                data-testid="status-badge"
                :variant="getQuoteStatusVariant(quote.status)"
              >
                {{ t(getQuoteStatusLabelKey(quote.status)) }}
              </Badge>
            </div>
          </header>

          <div
            data-testid="quote-summary-card"
            class="bg-muted space-y-4 rounded-lg p-6"
          >
            <div data-testid="quote-summary">
              <p
                data-testid="quote-summary-lead-label"
                class="text-muted-foreground text-sm"
              >
                {{
                  t(
                    showIncVat
                      ? 'portal.quotations.sum_inc_vat'
                      : 'portal.quotations.sum_ex_vat',
                  )
                }}
              </p>
              <p
                data-testid="quote-summary-subtotal"
                class="mt-1 text-3xl font-semibold tracking-tight tabular-nums"
              >
                {{ amounts.subtotal }}
              </p>
              <dl
                class="text-muted-foreground border-border mt-4 space-y-1 border-t pt-3 text-sm"
              >
                <div
                  v-for="row in summaryRows"
                  :key="row.key"
                  :data-summary-row="row.key"
                  :data-testid="
                    row.key === 'shipping' ? 'shipping-row' : undefined
                  "
                  class="flex justify-between gap-4"
                  :class="{
                    'text-foreground font-semibold': row.emphasis,
                    'text-danger': row.key === 'discount',
                  }"
                >
                  <dt>{{ row.label }}</dt>
                  <dd
                    :data-testid="`quote-summary-${row.key}`"
                    class="tabular-nums"
                  >
                    {{ row.value }}
                  </dd>
                </div>
              </dl>
            </div>

            <div
              v-if="store.error"
              data-testid="action-error"
              role="alert"
              class="bg-danger/10 text-danger border-danger/20 rounded-md border px-3 py-2 text-sm"
            >
              {{ t(store.error) }}
            </div>

            <Button
              v-if="responses.withdraw"
              data-testid="quote-withdraw"
              variant="outline"
              class="w-full shadow-none"
              @click="pendingAction = 'withdraw'"
            >
              {{ t('portal.quotations.withdraw') }}
            </Button>

            <template v-if="responses.accept">
              <div class="flex gap-2">
                <Button
                  data-testid="decline-btn"
                  variant="outline"
                  class="flex-1 shadow-none"
                  @click="pendingAction = 'decline'"
                >
                  {{ t('portal.quotations.decline') }}
                </Button>
                <Button
                  data-testid="accept-btn"
                  class="h-auto flex-1 py-2 whitespace-normal"
                  @click="pendingAction = 'accept'"
                >
                  {{ t(`portal.quotations.accept_${acceptKind}`) }}
                </Button>
              </div>
              <!-- No note without confirmation: nothing follows the accept until ordering exists. -->
              <p
                v-if="acceptKind !== 'plain'"
                data-testid="quote-accept-note"
                class="text-muted-foreground text-xs"
              >
                {{ t(`portal.quotations.note_${acceptKind}`) }}
              </p>
            </template>
          </div>

          <div
            v-if="metaRows.length"
            data-testid="quote-meta"
            class="bg-muted space-y-4 rounded-lg p-6"
          >
            <template v-for="(row, i) in metaRows" :key="row.key">
              <hr v-if="i > 0" class="border-border" />
              <div
                :data-testid="row.testId"
                :data-meta-row="row.key"
                class="flex items-start gap-3"
              >
                <component
                  :is="row.icon"
                  class="text-muted-foreground mt-0.5 size-4 shrink-0"
                />
                <div class="space-y-1">
                  <p class="text-foreground text-sm font-semibold">
                    {{ row.label }}
                  </p>
                  <p
                    v-for="line in row.lines"
                    :key="line"
                    class="text-muted-foreground text-sm break-words whitespace-pre-line"
                  >
                    {{ line }}
                  </p>
                </div>
              </div>
            </template>
          </div>

          <Accordion
            v-if="hasCustomerCard"
            type="single"
            collapsible
            data-testid="customer-info-card"
            class="bg-muted rounded-lg px-6"
          >
            <AccordionItem value="customer" class="border-none">
              <AccordionTrigger
                class="group items-center py-5 hover:no-underline"
              >
                <div data-testid="customer-card-trigger" class="min-w-0">
                  <p class="text-foreground text-sm font-semibold">
                    {{ t('portal.quotations.customer_and_addresses') }}
                  </p>
                  <p
                    v-if="customerSummary"
                    data-testid="customer-card-summary"
                    class="text-muted-foreground mt-1 text-sm font-normal group-data-[state=open]:hidden"
                  >
                    {{ customerSummary }}
                  </p>
                </div>
              </AccordionTrigger>
              <AccordionContent class="space-y-4 pb-6">
                <div v-if="quote.company" data-testid="customer-info">
                  <p class="text-foreground mb-2 text-sm font-semibold">
                    {{ t('portal.quotations.customer_info') }}
                  </p>
                  <p
                    v-if="quote.company.name"
                    class="text-muted-foreground text-sm"
                  >
                    {{ quote.company.name }}
                  </p>
                  <p
                    v-if="quote.company.companyId"
                    class="text-muted-foreground text-sm"
                  >
                    {{ t('portal.quotations.org_number') }}:
                    {{ quote.company.companyId }}
                  </p>
                  <p
                    v-if="quote.company.vatNumber"
                    class="text-muted-foreground text-sm"
                  >
                    {{ t('portal.quotations.vat_number') }}:
                    {{ quote.company.vatNumber }}
                  </p>
                </div>
                <hr
                  v-if="
                    quote.company &&
                    (quote.billingAddress || quote.shippingAddress)
                  "
                  class="border-border"
                />
                <AddressBlock
                  v-if="quote.billingAddress"
                  bare
                  label-style="header"
                  company-muted
                  data-testid="invoice-address"
                  :label="t('portal.quotations.invoice_address')"
                  :address="quote.billingAddress"
                />
                <hr
                  v-if="quote.billingAddress && quote.shippingAddress"
                  class="border-border"
                />
                <AddressBlock
                  v-if="quote.shippingAddress"
                  bare
                  label-style="header"
                  company-muted
                  data-testid="delivery-address"
                  :label="t('portal.quotations.delivery_address')"
                  :address="quote.shippingAddress"
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </aside>
      </div>

      <PortalDialogConfirmQuoteAction
        v-if="actionCopy"
        v-model:open="actionOpen"
        :title="actionCopy.title"
        :description="actionCopy.description"
        :confirm-label="actionCopy.confirm"
        :destructive="actionCopy.destructive"
        :pending="store.isActionLoading"
        @confirm="runAction"
      />
    </div>
  </PortalShell>
</template>
