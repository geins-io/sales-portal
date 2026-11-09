<script setup lang="ts">
import { ArrowLeft, FileText, MessageSquare } from 'lucide-vue-next';
import { Card, CardContent } from '~/components/ui/card';
import { Label } from '~/components/ui/label';
import CheckoutCardHeader from '~/components/checkout/CheckoutCardHeader.vue';
import { useQuotesStore } from '~/stores/quotes';
import { useAuthStore } from '~/stores/auth';
import { quoteAmounts } from '~/utils/quote-view';
import type { Company } from '#shared/types/company';
import type { Quote } from '#shared/types/quote';

definePageMeta({
  layout: 'checkout',
  middleware: ['auth', 'feature'],
  feature: 'quotes',
});

const COMMENT_MAX_LENGTH = 2000;
const REFERENCE_MAX_LENGTH = 30;

const { t } = useI18n();
const { formatLocale } = useFormatLocale();
const { showIncVat } = useVatDisplay();
const route = useRoute();
const store = useQuotesStore();
const authStore = useAuthStore();
const { localePath } = useLocaleMarket();

const quoteId = computed(() => route.params.id as string);
const quotationPath = computed(() =>
  localePath(`/portal/quotations/${quoteId.value}`),
);

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

const quote = computed(() => data.value!.quote);

// A sent request is locked; the view shows it.
const isDraft = computed(() => quote.value.status === 'request_draft');
if (!isDraft.value) {
  await navigateTo(quotationPath.value, { replace: true });
}

const company = ref<Company | null>(null);
if (isDraft.value) {
  const { data: companyData } = await useFetch<{ company: Company }>(
    '/api/portal/company',
    { dedupe: 'defer' },
  );
  company.value = companyData.value?.company ?? null;
}

store.error = null;

const title = computed(() =>
  t('portal.quotations.request.heading', {
    name: quote.value.name ?? `#${quote.value.quoteNumber}`,
  }),
);
useHead({ title });

const hasLines = computed(() => quote.value.lineItems.length > 0);
const amounts = computed(() =>
  quoteAmounts(quote.value, showIncVat.value, formatLocale.value),
);

const form = reactive({
  reference: '',
  desiredDeliveryDate: '',
  goodsLabel: '',
  comment: '',
});
// en-CA gives yyyy-mm-dd in the buyer's own timezone, as on the checkout.
const todayIso = new Date().toLocaleDateString('en-CA');
const submitted = ref(false);
// A typed date gets past the input's min.
const dateInPast = computed(
  () => !!form.desiredDeliveryDate && form.desiredDeliveryDate < todayIso,
);
const sending = computed(() => store.isActionLoading);

async function send() {
  submitted.value = true;
  if (dateInPast.value || !hasLines.value || sending.value) return;
  const sent = await store.sendQuoteRequest(quote.value.id, {
    desiredDeliveryDate: form.desiredDeliveryDate || undefined,
    customerOrderNumber: form.reference.trim() || undefined,
    goodsLabel: form.goodsLabel.trim() || undefined,
    comment: form.comment.trim() || undefined,
  });
  if (sent) await navigateTo(`${quotationPath.value}/sent`);
}
</script>

<template>
  <div class="min-h-full bg-neutral-50">
    <div
      v-if="isDraft"
      class="mx-auto max-w-7xl px-4 py-8 lg:px-6"
      data-testid="quote-request-page"
    >
      <NuxtLink
        :to="quotationPath"
        data-testid="quote-request-back"
        class="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft class="size-4" />
        {{ t('portal.quotations.request.back') }}
      </NuxtLink>

      <div
        class="border-info/40 bg-info/10 mb-6 flex flex-wrap items-start gap-3 rounded-lg border p-4"
        data-testid="quote-request-banner"
      >
        <div
          class="bg-info flex size-9 shrink-0 items-center justify-center rounded-md"
        >
          <FileText class="size-4 text-white" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold">
            {{ t('portal.quotations.request.banner_title') }}
          </p>
          <p class="text-muted-foreground mt-0.5 text-sm">
            {{ t('portal.quotations.request.banner_body') }}
          </p>
        </div>
      </div>

      <h1
        class="mb-6 text-2xl font-semibold break-words"
        data-testid="quote-request-title"
      >
        {{ title }}
      </h1>

      <div class="flex flex-col gap-8 lg:flex-row lg:items-start">
        <div class="min-w-0 flex-1 space-y-6">
          <PortalQuoteArticles :items="quote.lineItems">
            <template #empty>
              <p
                class="text-muted-foreground py-6 text-center text-sm"
                data-testid="quote-request-empty"
              >
                {{ t('portal.quotations.request.empty') }}
              </p>
            </template>
          </PortalQuoteArticles>

          <template v-if="company">
            <CheckoutCompanyInfo
              :company="company"
              :buyer-email="authStore.user?.username ?? undefined"
              :customer-order-number="form.reference"
              :reference-max-length="REFERENCE_MAX_LENGTH"
              :reference-help="t('portal.quotations.request.reference_help')"
              :disabled="sending"
              @update:customer-order-number="form.reference = $event"
            />
            <div class="space-y-2">
              <CheckoutDeliveryInfo
                :company="company"
                :desired-delivery-date="form.desiredDeliveryDate"
                :goods-label="form.goodsLabel"
                :disabled="sending"
                :today-iso="todayIso"
                :date-label="t('portal.quotations.request.desired_date')"
                :date-help="t('portal.quotations.request.desired_date_help')"
                @update:desired-delivery-date="
                  form.desiredDeliveryDate = $event
                "
                @update:goods-label="form.goodsLabel = $event"
              />
              <p
                v-if="submitted && dateInPast"
                role="alert"
                data-testid="quote-request-date-error"
                class="text-danger px-1 text-sm"
              >
                {{ t('portal.quotations.request.date_past') }}
              </p>
            </div>
          </template>

          <Card>
            <CheckoutCardHeader
              :icon="MessageSquare"
              :title="t('portal.quotations.request.card_message')"
            />
            <CardContent class="space-y-2 px-6">
              <Label for="quote-request-message">{{
                t('portal.quotations.request.comment')
              }}</Label>
              <textarea
                id="quote-request-message"
                v-model="form.comment"
                :placeholder="
                  t('portal.quotations.request.comment_placeholder')
                "
                :maxlength="COMMENT_MAX_LENGTH"
                :disabled="sending"
                rows="4"
                class="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="quote-request-message"
              />
              <p
                class="text-muted-foreground text-right text-xs tabular-nums"
                data-testid="quote-request-message-count"
              >
                {{ form.comment.length }} / {{ COMMENT_MAX_LENGTH }}
              </p>
            </CardContent>
          </Card>
        </div>

        <!-- self-stretch gives the sticky summary room, as on the checkout. -->
        <div class="w-full lg:w-80 lg:shrink-0 lg:self-stretch">
          <CheckoutOrderSummary
            :item-count="quote.lineItems.length"
            item-count-key="portal.quotations.request.lines_count"
            :action-icon="FileText"
            :subtotal="amounts.subtotal ?? ''"
            :shipping-fee="amounts.shipping ?? null"
            :tax="amounts.tax ?? null"
            :total="amounts.total ?? ''"
            :discount="amounts.discount"
            :to-pay-inc-vat="amounts.totalIncVat"
            :to-pay-label="t('common.total_inc_vat')"
            :shipping-note="t('portal.quotations.request.shipping_note')"
            :can-place-order="hasLines"
            :is-placing-order="sending"
            :terms-accepted="true"
            :require-terms="false"
            :title="t('portal.quotations.request.summary_title')"
            :action-label="t('portal.quotations.request.send')"
            :action-pending-label="t('portal.quotations.request.sending')"
            @place-order="send"
          >
            <template #title-aside>
              <QuoteEstimateBadge />
            </template>
            <template #footer>
              <p
                class="text-muted-foreground text-xs"
                data-testid="quote-request-hint"
              >
                {{ t('portal.quotations.request.send_hint') }}
              </p>
              <p
                v-if="store.error"
                role="alert"
                data-testid="quote-request-error"
                class="bg-danger/10 text-danger border-danger/20 rounded-md border px-3 py-2 text-sm"
              >
                {{ t(store.error) }}
              </p>
            </template>
          </CheckoutOrderSummary>
        </div>
      </div>
    </div>
  </div>
</template>
