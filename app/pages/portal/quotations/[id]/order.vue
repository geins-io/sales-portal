<script setup lang="ts">
import {
  ArrowLeft,
  Building2,
  CreditCard,
  FileText,
  Loader2,
  MapPin,
  Package,
  ShoppingBag,
} from 'lucide-vue-next';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import CheckoutCardHeader from '~/components/checkout/CheckoutCardHeader.vue';
import { useQuotesStore } from '~/stores/quotes';
import { quoteCanOrder } from '~/utils/quote-view';
import type { Quote } from '#shared/types/quote';

definePageMeta({
  layout: 'checkout',
  middleware: ['auth', 'feature'],
  feature: 'quotes',
});

const { t } = useI18n();
const { formatLocale } = useFormatLocale();
const { timezone } = useTenant();
const route = useRoute();
const store = useQuotesStore();
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

const acceptedTerms = ref(false);
const submitted = ref(false);
const placing = ref(false);

async function placeOrder() {
  submitted.value = true;
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
        class="border-primary/40 bg-primary/10 mb-6 flex flex-wrap items-start gap-3 rounded-lg border p-4"
        data-testid="quote-order-banner"
      >
        <div
          class="bg-primary flex size-9 shrink-0 items-center justify-center rounded-md"
        >
          <FileText class="text-primary-foreground size-4" />
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
          <Card class="gap-0">
            <CheckoutCardHeader
              :icon="Package"
              :title="t('portal.quotations.items_heading')"
            />
            <CardContent class="px-6 pt-4">
              <PortalQuoteItems :items="quote.lineItems" />
            </CardContent>
          </Card>

          <Card v-if="quote.company" data-testid="quote-order-company">
            <CheckoutCardHeader
              :icon="Building2"
              :title="t('portal.quotations.order.card_company')"
            />
            <CardContent class="px-6 text-sm">
              <p
                class="text-foreground mb-1 text-xs font-medium tracking-wide uppercase"
              >
                {{ t('portal.quotations.order.card_company') }}
              </p>
              <p v-if="quote.company.name" class="text-muted-foreground">
                {{ quote.company.name }}
              </p>
              <p
                v-if="quote.company.vatNumber"
                data-testid="quote-order-org-number"
                class="text-muted-foreground"
              >
                {{ t('checkout.vat_number') }}:
                {{ quote.company.vatNumber }}
              </p>
            </CardContent>
          </Card>

          <Card v-if="quote.shippingAddress || quote.billingAddress">
            <CheckoutCardHeader
              :icon="MapPin"
              :title="t('portal.quotations.order.card_addresses')"
            />
            <CardContent class="space-y-4 px-6">
              <div class="grid gap-6 sm:grid-cols-2">
                <AddressBlock
                  v-if="quote.shippingAddress"
                  bare
                  label-style="header"
                  company-muted
                  data-testid="order-delivery-address"
                  :label="t('portal.quotations.delivery_address')"
                  :address="quote.shippingAddress"
                />
                <AddressBlock
                  v-if="quote.billingAddress"
                  bare
                  label-style="header"
                  company-muted
                  data-testid="order-invoice-address"
                  :label="t('portal.quotations.invoice_address')"
                  :address="quote.billingAddress"
                />
              </div>
              <p class="text-muted-foreground text-xs">
                {{ t('portal.quotations.order.addresses_locked') }}
              </p>
            </CardContent>
          </Card>

          <Card data-testid="quote-order-payment">
            <CheckoutCardHeader
              :icon="CreditCard"
              :title="t('portal.quotations.order.card_payment')"
            />
            <CardContent class="px-6 text-sm">
              <p class="font-medium">
                {{ t('portal.quotations.order.invoice') }}
              </p>
              <p v-if="quote.paymentTerms" class="text-muted-foreground">
                {{ t('portal.quotations.payment_terms') }}:
                {{ quote.paymentTerms }}
              </p>
            </CardContent>
          </Card>
        </div>

        <!-- self-stretch gives the sticky summary room, as on the checkout. -->
        <div class="w-full lg:w-80 lg:shrink-0 lg:self-stretch">
          <div
            class="bg-muted border-border space-y-4 rounded-lg border p-6 lg:sticky lg:top-24"
            data-testid="quote-summary-card"
          >
            <PortalQuoteSummary :quote="quote" />
            <CheckoutTermsAgreement
              v-model="acceptedTerms"
              :disabled="placing"
            />
            <p
              v-if="submitted && !acceptedTerms"
              role="alert"
              data-testid="quote-order-terms-required"
              class="text-danger -mt-2 text-sm"
            >
              {{ t('portal.quotations.order.terms_required') }}
            </p>
            <Button
              size="lg"
              class="w-full"
              data-testid="quote-order-place"
              :disabled="placing"
              @click="placeOrder"
            >
              <Loader2 v-if="placing" class="size-4 animate-spin" />
              <ShoppingBag v-else class="size-4" />
              {{ t('checkout.place_order') }}
            </Button>
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
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
