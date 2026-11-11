<script setup lang="ts">
import type { FunctionalComponent } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { useEventListener } from '@vueuse/core';
import {
  ArrowLeft,
  Calendar,
  CalendarPlus,
  Check,
  CircleCheck,
  Clock,
  FileText,
  Hash,
  History,
  Info,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  ShoppingBag,
  Tag,
  Truck,
  User,
} from 'lucide-vue-next';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
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
  quoteAmounts,
  quoteDiscountLabel,
  quoteKindLabelKey,
  quoteResponses,
  quoteRows,
  quoteStatusInfoKey,
} from '~/utils/quote-view';
import { summaryRows } from '~/utils/summary-rows';
import type { Quote, QuoteLineItem } from '#shared/types/quote';
import { QUOTE_NAME_MAX_LENGTH } from '#shared/constants/quote';

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
/** A request draft is edited here; from `REQUESTED` on the view is read-only. */
const isDraft = computed(() => quote.value?.status === 'request_draft');

useHead({
  title: computed(
    () =>
      quote.value?.name ??
      `${t('portal.quotations.detail_title')} #${quote.value?.quoteNumber ?? ''}`,
  ),
});

// ------------------------------------------------------- buyer responses
const canPlaceOrders = computed(() => canAccess('orderPlacement'));
const responses = computed(() =>
  quoteResponses(
    quote.value ?? { status: 'unknown', requiresConfirmation: false },
    canPlaceOrders.value,
  ),
);
const orderPath = computed(() =>
  localePath(`/portal/quotations/${quoteId.value}/order`),
);

const hasResponses = computed(
  () =>
    !isDraft.value &&
    (!!store.error ||
      responses.value.withdraw ||
      !!responses.value.accept ||
      responses.value.placeOrder),
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
  const key = action === 'accept' ? `accept_${responses.value.accept}` : action;
  return {
    title: t(`portal.quotations.${key}_title`),
    description: t(
      (action === 'accept' && responses.value.acceptBodyKey) ||
        `portal.quotations.${key}_body`,
    ),
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

// ------------------------------------------------------------ the draft
const editing = useQuoteDraftEditing({
  quote: () => quote.value as Quote,
  save: (update) => store.updateDraft(quoteId.value, update),
  onSaved: (answer) => {
    data.value = { quote: answer };
  },
  // The page shows what Geins holds, not what failed to reach it. A failed
  // `refresh()` would empty `data`; a failed read here keeps the last draft.
  onFailed: async () => {
    try {
      data.value = await $fetch<{ quote: Quote }>(
        `/api/quotes/${quoteId.value}`,
      );
    } catch {
      // The save's error is already shown.
    }
  },
});
const { lines: draftLines, notice, saving, saved, canRemove } = editing;

const noticeText = computed(() =>
  notice.value
    ? t(`portal.quotations.draft.${notice.value.kind}`, {
        name: notice.value.name,
      })
    : '',
);

// Nothing waiting is lost, or sent stale, when the buyer goes on or away.
// Closing or reloading the tab cannot wait for a save, so it asks first.
if (isDraft.value) {
  onBeforeRouteLeave(async () => ((await editing.flush()) ? undefined : false));
  useEventListener('beforeunload', (event) => {
    if (!saving.value) return;
    event.preventDefault();
    // Older Chrome and Safari ask only when this is set.
    event.returnValue = '';
  });
}

const requestPath = computed(() =>
  localePath(`/portal/quotations/${quoteId.value}/request`),
);

const editingName = ref(false);
const nameDraft = ref('');
const nameInput = ref<HTMLInputElement | null>(null);

function startRename() {
  nameDraft.value = quote.value?.name ?? '';
  editingName.value = true;
  nextTick(() => {
    nameInput.value?.focus();
    nameInput.value?.select();
  });
}

function commitRename() {
  if (!editingName.value) return;
  editingName.value = false;
  const name = nameDraft.value.trim();
  if (name && name !== quote.value?.name) editing.rename(name);
}

// Rename starts once the menu has closed: started from the item, the closing
// menu would take the focus back from the name field.
const renameRequested = ref(false);

function onMenuCloseAutoFocus(event: Event) {
  if (!renameRequested.value) return;
  event.preventDefault();
  renameRequested.value = false;
  startRename();
}

const deleteOpen = ref(false);
/** Whether the delete dialog was opened by removing the last line. */
const deleteLastLine = ref(false);

function openDelete() {
  deleteLastLine.value = false;
  deleteOpen.value = true;
}

/** The last line goes only with the whole draft, so that is asked first. */
function removeLine(line: QuoteLineItem) {
  if (canRemove.value) {
    editing.remove(line);
    return;
  }
  deleteLastLine.value = true;
  deleteOpen.value = true;
}

async function confirmDelete() {
  await editing.flush();
  if (await store.deleteDraft(quoteId.value)) {
    deleteOpen.value = false;
    await navigateTo(localePath('/portal/quotations'));
  }
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

/** A calendar day (`YYYY-MM-DD`) read in UTC, so no timezone moves it. */
function formatDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(formatLocale.value, {
    timeZone: 'UTC',
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
  const infoKey = quoteStatusInfoKey(q, canPlaceOrders.value);
  add({
    key: 'status',
    testId: 'quote-meta-status',
    icon: Info,
    label: t('portal.quotations.status_label'),
    lines: infoKey ? [t(infoKey)] : [],
  });
  // What the buyer sent; a draft has sent nothing yet.
  const sent = q.status === 'request_draft' ? undefined : q.request;
  add({
    key: 'your-reference',
    testId: 'quote-meta-your-reference',
    icon: Hash,
    label: t('portal.quotations.your_reference'),
    lines: [sent?.customerOrderNumber ?? ''],
  });
  add({
    key: 'desired-date',
    testId: 'quote-meta-desired-date',
    icon: Truck,
    label: t('portal.quotations.desired_date'),
    lines: sent?.desiredDeliveryDate
      ? [formatDay(sent.desiredDeliveryDate)]
      : [],
  });
  add({
    key: 'goods-label',
    testId: 'quote-meta-goods-label',
    icon: Tag,
    label: t('portal.quotations.goods_label'),
    lines: [sent?.goodsLabel ?? ''],
  });
  add({
    key: 'comment',
    testId: 'quote-meta-comment',
    icon: MessageSquare,
    label: t('portal.quotations.comment'),
    lines: [sent?.comment ?? ''],
  });
  add({
    key: 'expires',
    testId: 'expires-at',
    icon: Calendar,
    label: t('portal.quotations.expires_at'),
    lines: q.expiresAt ? [formatDate(q.expiresAt)] : [],
  });
  add({
    key: 'updated',
    testId: 'quote-meta-updated',
    icon: History,
    label: t('portal.quotations.draft.updated_at'),
    lines: isDraft.value && q.updatedAt ? [formatDate(q.updatedAt)] : [],
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

// A draft has no addresses yet: they are chosen when the request is sent.
const hasCustomerCard = computed(
  () =>
    !isDraft.value &&
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
        <p
          v-if="isDraft && (saving || saved)"
          data-testid="quote-save-state"
          class="text-muted-foreground inline-flex items-center gap-1.5 text-xs"
          aria-live="polite"
        >
          <template v-if="saving">
            <Loader2 class="size-3.5 animate-spin" />{{
              t('portal.quotations.draft.saving')
            }}
          </template>
          <template v-else>
            <Check class="size-3.5" />{{ t('portal.quotations.draft.saved') }}
          </template>
        </p>
      </div>

      <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <!-- Left, a draft: quick add and the lines, edited. On a phone they
             stay on the page, under the summary, as in a cart. -->
        <div
          v-if="isDraft"
          data-testid="quote-draft-lines"
          class="order-2 min-w-0 space-y-4 lg:order-1 lg:col-span-2"
        >
          <div
            class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <h3 class="text-base font-semibold">
              {{ t('portal.quotations.items_heading') }}
            </h3>
            <PortalQuoteQuickAdd
              class="w-full sm:w-80"
              :pending="store.isSaving"
              @add="editing.add"
            />
          </div>
          <p
            v-if="store.error"
            data-testid="draft-error"
            role="alert"
            class="bg-danger/10 text-danger border-danger/20 rounded-md border px-3 py-2 text-sm"
          >
            {{ t(store.error) }}
          </p>
          <p
            v-if="notice"
            data-testid="quote-notice"
            role="status"
            class="bg-muted flex items-center justify-between gap-3 rounded-md px-4 py-2.5 text-sm"
          >
            <span>{{ noticeText }}</span>
            <Button
              v-if="notice.undo"
              data-testid="quote-undo"
              variant="link"
              size="sm"
              class="h-auto px-0"
              @click="notice.undo()"
            >
              {{ t('portal.quotations.draft.undo') }}
            </Button>
          </p>
          <PortalQuoteDraftTable
            :lines="draftLines"
            :totals="totals"
            @quantity="editing.setQuantity"
            @remove="removeLine"
          />
        </div>

        <!-- Left: the lines (desktop only; below lg they are in the sheet) -->
        <div v-else class="hidden min-w-0 lg:col-span-2 lg:block">
          <OrderItemsTable
            :items="lineRows"
            :rows="totals"
            show-prices
            :title="t('portal.quotations.items_heading')"
          />
        </div>

        <!-- Right: header, summary with the responses, details, customer -->
        <aside class="order-1 space-y-6 lg:order-2">
          <header data-testid="quote-header">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <form
                  v-if="editingName"
                  data-testid="quote-name-form"
                  @submit.prevent="commitRename"
                >
                  <label for="quote-name-input" class="sr-only">{{
                    t('portal.quotations.draft.name_label')
                  }}</label>
                  <input
                    id="quote-name-input"
                    ref="nameInput"
                    v-model="nameDraft"
                    data-testid="quote-name-input"
                    autocomplete="off"
                    :maxlength="QUOTE_NAME_MAX_LENGTH"
                    class="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-md border bg-transparent px-3 text-xl font-semibold focus-visible:ring-[3px] focus-visible:outline-none"
                    @keydown.escape.prevent="editingName = false"
                    @blur="commitRename"
                  />
                </form>
                <h2
                  v-else
                  data-testid="quote-title"
                  class="text-2xl font-semibold wrap-break-word"
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
              <div class="flex items-center gap-1">
                <Badge
                  data-testid="status-badge"
                  :variant="getQuoteStatusVariant(quote.status)"
                >
                  {{ t(getQuoteStatusLabelKey(quote.status)) }}
                </Badge>
                <DropdownMenu v-if="isDraft">
                  <DropdownMenuTrigger as-child>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      data-testid="quote-more"
                      :aria-label="
                        t('portal.quotations.draft.more', {
                          name: quote.name ?? '',
                        })
                      "
                    >
                      <MoreHorizontal class="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    @close-auto-focus="onMenuCloseAutoFocus"
                  >
                    <DropdownMenuItem
                      data-testid="quote-rename"
                      @select="renameRequested = true"
                    >
                      {{ t('portal.quotations.draft.rename') }}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      data-testid="quote-delete"
                      @select="openDelete"
                    >
                      {{ t('portal.quotations.draft.delete') }}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          <OrderSummaryCard
            :rows="totals"
            show-prices
            :title="t('portal.quotations.request.summary_title')"
          >
            <template v-if="isDraft" #heading-aside>
              <QuoteEstimateBadge />
            </template>
            <template v-if="isDraft" #default>
              <Button as-child class="w-full" data-testid="quote-continue">
                <NuxtLink :to="requestPath">
                  {{ t('portal.quotations.draft.continue') }}
                </NuxtLink>
              </Button>
              <p
                data-testid="quote-continue-hint"
                class="text-muted-foreground text-xs"
              >
                {{ t('portal.quotations.draft.continue_hint') }}
              </p>
            </template>
            <!-- Only with something to show, or the card keeps an empty gap. -->
            <template v-else-if="hasResponses" #default>
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
                    v-if="responses.accept === 'order'"
                    as-child
                    data-testid="accept-btn"
                    class="h-auto flex-1 py-2 whitespace-normal"
                  >
                    <NuxtLink :to="orderPath">
                      {{ t('portal.quotations.accept_and_order') }}
                    </NuxtLink>
                  </Button>
                  <Button
                    v-else
                    data-testid="accept-btn"
                    class="h-auto flex-1 py-2 whitespace-normal"
                    @click="pendingAction = 'accept'"
                  >
                    {{ t(`portal.quotations.accept_${responses.accept}`) }}
                  </Button>
                </div>
                <p
                  v-if="responses.noteKey"
                  data-testid="quote-accept-note"
                  class="text-muted-foreground text-xs"
                >
                  {{ t(responses.noteKey) }}
                </p>
              </template>

              <Button
                v-if="responses.placeOrder"
                as-child
                data-testid="quote-place-order"
                class="w-full"
              >
                <NuxtLink :to="orderPath">
                  {{ t('checkout.place_order') }}
                </NuxtLink>
              </Button>
            </template>
          </OrderSummaryCard>

          <PortalItemRowsSheet
            v-if="!isDraft"
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
              <PortalMetaRow
                :row-key="row.key"
                :test-id="row.testId"
                :icon="row.icon"
                :label="row.label"
                :lines="row.lines"
                :href="row.href"
              />
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

      <PortalDialogDeleteQuoteDraft
        v-if="isDraft"
        v-model:open="deleteOpen"
        :name="quote.name ?? ''"
        :pending="store.isSaving"
        :last-line="deleteLastLine"
        @confirm="confirmDelete"
      />
    </div>
  </PortalShell>
</template>
