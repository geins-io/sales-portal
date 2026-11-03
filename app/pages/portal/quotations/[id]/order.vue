<script setup lang="ts">
import { ArrowLeft, CreditCard, FileText } from 'lucide-vue-next';
import { Card, CardContent } from '~/components/ui/card';
import CheckoutCardHeader from '~/components/checkout/CheckoutCardHeader.vue';
import { useAuthStore } from '~/stores/auth';
import { useQuotesStore } from '~/stores/quotes';
import { quoteAmounts, quoteCanOrder } from '~/utils/quote-view';
import {
  quoteCheckoutCompany,
  quotePaymentOptions,
} from '~/utils/quote-checkout';
import type { Quote } from '#shared/types/quote';

definePageMeta({
  layout: 'checkout',
  middleware: ['auth', 'feature'],
  feature: 'quotes',
});

const { t } = useI18n();
const { formatLocale } = useFormatLocale();
const { timezone } = useTenant();
const { showIncVat } = useVatDisplay();
const route = useRoute();
const store = useQuotesStore();
const authStore = useAuthStore();
const { localePath } = useLocaleMarket();
const { canAccess } = useFeatureAccess();

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

// The feature middleware takes one feature; placing an order needs both.
const orderable = computed(
  () => quoteCanOrder(quote.value) && canAccess('orderPlacement'),
);
if (!orderable.value) {
  await navigateTo(quotationPath.value, { replace: true });
}

store.error = null;

const title = computed(() =>
  t('portal.quotations.order.heading', {
    name: quote.value.name ?? `#${quote.value.quoteNumber}`,
  }),
);
useHead({ title });

// The order takes all of this from the quotation, so the page shows it locked.
const itemCount = computed(() =>
  quote.value.lineItems.reduce((sum, line) => sum + line.quantity, 0),
);
const company = computed(() => quoteCheckoutCompany(quote.value));
const request = computed(() => quote.value.request ?? {});
const showDelivery = computed(
  () =>
    !!company.value &&
    (!!company.value.addresses?.length ||
      !!request.value.desiredDeliveryDate ||
      !!request.value.goodsLabel),
);
const paymentOptions = computed(() => quotePaymentOptions(quote.value));
// With several methods, which one the order gets is not known.
const selectedPaymentId = computed(() =>
  paymentOptions.value.length === 1 ? paymentOptions.value[0]!.id : null,
);
const amounts = computed(() =>
  quoteAmounts(quote.value, showIncVat.value, formatLocale.value),
);
const todayIso = new Date().toLocaleDateString('en-CA');

const acceptedTerms = ref(false);
const placing = ref(false);

async function placeOrder() {
  if (!acceptedTerms.value || placing.value) return;
  placing.value = true;
  const ordered = await store.finalizeQuote(quote.value.id);
  placing.value = false;
  // The quotation view shows it as finalized until a thank-you page exists.
  if (ordered) await navigateTo(quotationPath.value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(formatLocale.value, {
    ...(timezone.value ? { timeZone: timezone.value } : {}),
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
</script>

<template>
  <div class="min-h-full bg-neutral-50">
    <div
      v-if="orderable"
      class="mx-auto max-w-7xl px-4 py-8 lg:px-6"
      data-testid="quote-order-page"
    >
      <NuxtLink
        :to="quotationPath"
        data-testid="quote-order-back"
        class="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft class="size-4" />
        {{ t('portal.quotations.order.back') }}
      </NuxtLink>

      <div
        class="border-info/40 bg-info/10 mb-6 flex flex-wrap items-start gap-3 rounded-lg border p-4"
        data-testid="quote-order-banner"
      >
        <div
          class="bg-info flex size-9 shrink-0 items-center justify-center rounded-md"
        >
          <FileText class="size-4 text-white" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold">
            {{
              t('portal.quotations.order.banner_title', {
                number: quote.quoteNumber,
              })
            }}
          </p>
          <p class="text-muted-foreground mt-0.5 text-sm">
            {{ t('portal.quotations.order.banner_body') }}
          </p>
        </div>
      </div>

      <h1
        class="mb-6 text-2xl font-semibold break-words"
        data-testid="quote-order-title"
      >
        {{ title }}
      </h1>

      <div class="flex flex-col gap-8 lg:flex-row lg:items-start">
        <div class="min-w-0 flex-1 space-y-6">
          <PortalQuoteArticles :items="quote.lineItems" />

          <CheckoutCompanyInfo
            v-if="company"
            :company="company"
            :buyer-email="authStore.user?.username ?? undefined"
            :customer-order-number="request.customerReference ?? ''"
            locked
          />

          <CheckoutDeliveryInfo
            v-if="company && showDelivery"
            :company="company"
            :desired-delivery-date="request.desiredDeliveryDate ?? ''"
            :goods-label="request.goodsLabel ?? ''"
            :today-iso="todayIso"
            locked
          >
            <template #footer>
              <p
                data-testid="quote-order-addresses-locked"
                class="text-muted-foreground text-xs"
              >
                {{ t('portal.quotations.order.addresses_locked') }}
              </p>
            </template>
          </CheckoutDeliveryInfo>

          <Card
            v-if="paymentOptions.length || quote.paymentTerms"
            data-testid="quote-order-payment"
          >
            <CheckoutCardHeader
              :icon="CreditCard"
              :title="t('checkout.payment_method')"
            />
            <CardContent class="space-y-3 px-6">
              <CheckoutPaymentOptions
                v-if="paymentOptions.length"
                :options="paymentOptions"
                :model-value="selectedPaymentId"
                disabled
              />
              <p
                v-if="quote.paymentTerms"
                data-testid="quote-order-payment-terms"
                class="text-muted-foreground text-sm"
              >
                {{ t('portal.quotations.payment_terms') }}:
                {{ quote.paymentTerms }}
              </p>
            </CardContent>
          </Card>
        </div>

        <!-- self-stretch gives the sticky summary room, as on the checkout. -->
        <div class="w-full lg:w-80 lg:shrink-0 lg:self-stretch">
          <CheckoutOrderSummary
            :item-count="itemCount"
            :subtotal="amounts.subtotal ?? ''"
            :shipping-fee="amounts.shipping ?? null"
            :tax="amounts.tax || null"
            :total="amounts.total ?? ''"
            :discount="amounts.discount"
            :to-pay-inc-vat="amounts.totalIncVat"
            :can-place-order="true"
            :terms-accepted="acceptedTerms"
            :is-placing-order="placing"
            @place-order="placeOrder"
            @update:terms-accepted="acceptedTerms = $event"
          >
            <template #footer>
              <p
                v-if="store.error"
                role="alert"
                data-testid="quote-order-error"
                class="bg-danger/10 text-danger border-danger/20 rounded-md border px-3 py-2 text-sm"
              >
                {{ t(store.error) }}
              </p>
              <p
                v-if="quote.expiresAt"
                data-testid="quote-order-valid-until"
                class="text-muted-foreground text-xs"
              >
                {{
                  t('portal.quotations.order.valid_until', {
                    date: formatDate(quote.expiresAt),
                  })
                }}
              </p>
            </template>
          </CheckoutOrderSummary>
        </div>
      </div>
    </div>
  </div>
</template>
