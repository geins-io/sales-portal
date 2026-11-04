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
  ShoppingBag,
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
  quoteDiscountLabel,
  quoteKindLabelKey,
  quoteResponses,
  quoteRows,
  quoteStatusInfoKey,
} from '~/utils/quote-view';
import { summaryRows } from '~/utils/summary-rows';
import type { Quote } from '#shared/types/quote';

definePageMeta({ middleware: ['auth', 'feature'], feature: 'quotes' });

const { t } = useI18n();
const { formatLocale } = useFormatLocale();
const { timezone } = useTenant();
const route = useRoute();
const store = useQuotesStore();
const { localePath } = useLocaleMarket();
const { canAccess } = useFeatureAccess();

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

const hasResponses = computed(
  () => !!store.error || responses.value.withdraw || responses.value.accept,
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
// The order page's parts, fed the quotation: every amount on the buyer's VAT
// side, the prices shown whatever the tenant's price visibility.
const { showIncVat } = useVatDisplay();
const amounts = computed(() =>
  quoteAmounts(quote.value, showIncVat.value, formatLocale.value),
);
const lineRows = computed(() => quoteRows(quote.value, showIncVat.value));
const totals = computed(() =>
  summaryRows(
    amounts.value,
    quote.value?.lineItems.length ?? 0,
    showIncVat.value,
    t,
    {
      totalIncVatLabel: t('common.total_inc_vat'),
      discountLabel: quoteDiscountLabel(amounts.value, t),
    },
  ),
);

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(formatLocale.value, {
    ...(timezone.value ? { timeZone: timezone.value } : {}),
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

interface MetaRow {
  key: string;
  testId: string;
  icon: FunctionalComponent;
  label: string;
  lines: string[];
  /** Where the first line links to. */
  href?: string;
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
    key: 'order',
    testId: 'quote-meta-order',
    icon: ShoppingBag,
    label: t('portal.quotations.order_row'),
    lines: q.orderId ? [`#${q.orderId}`] : [],
    href:
      q.orderPublicId && canAccess('orderHistory')
        ? localePath(`/portal/orders/${encodeURIComponent(q.orderPublicId)}`)
        : undefined,
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
        <!-- Left: the lines (desktop only; below lg they are in the sheet) -->
        <div class="hidden min-w-0 lg:col-span-2 lg:block">
          <OrderItemsTable
            :items="lineRows"
            :rows="totals"
            show-prices
            :title="t('portal.quotations.items_heading')"
          />
        </div>

        <!-- Right: header, summary with the responses, details, customer -->
        <aside class="space-y-6">
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

          <OrderSummaryCard
            :rows="totals"
            show-prices
            :title="t('portal.quotations.request.summary_title')"
          >
            <!-- Only with something to show, or the card keeps an empty gap. -->
            <template v-if="hasResponses" #default>
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
            </template>
          </OrderSummaryCard>

          <PortalItemRowsSheet
            class="lg:hidden"
            :items="lineRows"
            :totals="totals"
            :trigger-label="t('portal.quotations.view_items')"
            :title="t('portal.quotations.items_heading')"
            show-prices
          />

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
                    v-for="(line, l) in row.lines"
                    :key="line"
                    class="text-muted-foreground text-sm break-words whitespace-pre-line"
                  >
                    <NuxtLink
                      v-if="row.href && l === 0"
                      :to="row.href"
                      :data-testid="`${row.testId}-link`"
                      class="text-primary hover:underline"
                      >{{ line }}</NuxtLink
                    >
                    <template v-else>{{ line }}</template>
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
                    v-if="quote.company.vatNumber"
                    data-testid="customer-org-number"
                    class="text-muted-foreground text-sm"
                  >
                    {{ t('checkout.vat_number') }}:
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
