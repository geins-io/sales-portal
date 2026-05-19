<script setup lang="ts">
import type { CheckoutSummaryOrderType, AddressType } from '@geins/types';
import { CircleCheck, FileText, ChevronDown, ChevronUp } from 'lucide-vue-next';

const props = defineProps<{
  summary: CheckoutSummaryOrderType | null;
  isLoading: boolean;
  paymentMethod?: string;
  reference?: string;
  /**
   * Human-friendly numeric order id forwarded from the checkout page in
   * the URL. Lets the badge render immediately even when the Geins
   * checkout summary hasn't propagated yet.
   */
  orderNumber?: string;
}>();

const displayOrderNumber = computed(
  () => props.summary?.orderId || props.orderNumber || '',
);

const { t } = useI18n();
const { localePath } = useLocaleMarket();

const COLLAPSED_ROW_LIMIT = 3;

const expanded = ref(false);

const rows = computed(() => props.summary?.rows ?? []);
const visibleRows = computed(() =>
  expanded.value ? rows.value : rows.value.slice(0, COLLAPSED_ROW_LIMIT),
);
const hasMoreRows = computed(() => rows.value.length > COLLAPSED_ROW_LIMIT);

const hasDiscount = computed(
  () => (props.summary?.total?.discountIncVat ?? 0) > 0,
);

function formatAddressLines(address: AddressType | undefined | null): string[] {
  if (!address) return [];
  const lines: string[] = [];
  if (address.company) lines.push(address.company);
  if (address.addressLine1) lines.push(address.addressLine1);
  if (address.addressLine2) lines.push(address.addressLine2);
  const cityLine = [address.zip, address.city].filter(Boolean).join(' ');
  if (cityLine) lines.push(cityLine);
  if (address.country) lines.push(address.country);
  return lines;
}

const buyerName = computed(() => {
  const a = props.summary?.billingAddress;
  if (!a) return '';
  return [a.firstName, a.lastName].filter(Boolean).join(' ');
});

const billingLines = computed(() =>
  formatAddressLines(props.summary?.billingAddress),
);
const shippingLines = computed(() =>
  formatAddressLines(props.summary?.shippingAddress),
);

const paymentLabel = computed(() => {
  const raw = props.paymentMethod;
  if (!raw) return null;
  const key = `checkout.payment_types.${raw}`;
  const localized = t(key);
  return localized === key ? raw : localized;
});

function lineUnitPrice(row: { price?: { priceIncVatFormatted?: string } }) {
  return row.price?.priceIncVatFormatted ?? '';
}

function lineTotal(row: {
  quantity?: number;
  price?: { priceIncVat?: number; priceIncVatFormatted?: string };
}) {
  // CheckoutSummaryPriceType doesn't expose a line total — multiply the
  // unit price by quantity for display. Falls back to the unit string if
  // numeric multiplication isn't possible.
  const unit = row.price?.priceIncVat;
  const qty = row.quantity ?? 0;
  if (typeof unit === 'number' && qty > 0) {
    const currency = props.summary?.total?.currency ?? '';
    const value = (unit * qty).toLocaleString('sv-SE');
    return `${value} ${currency}`.trim();
  }
  return row.price?.priceIncVatFormatted ?? '';
}
</script>

<template>
  <div data-testid="order-confirmation">
    <!-- Loading state -->
    <div
      v-if="isLoading"
      class="mx-auto max-w-3xl"
      data-testid="order-confirmation-loading"
    >
      <div class="bg-muted h-[600px] animate-pulse rounded-xl" />
    </div>

    <template v-else>
      <article
        class="border-border bg-card mx-auto max-w-3xl rounded-xl border px-8 py-10 sm:px-12 sm:py-12"
      >
        <!-- Header: icon + heading + subtitle + badge -->
        <header class="flex flex-col items-center gap-3 text-center">
          <CircleCheck
            class="text-primary size-12"
            data-testid="confirm-icon"
          />
          <h1 class="text-2xl font-bold sm:text-3xl">
            {{ t('order_confirmation.thank_you') }}
          </h1>
          <p class="text-muted-foreground max-w-md text-sm">
            {{ t('order_confirmation.confirmation_subtitle') }}
          </p>
          <div
            v-if="displayOrderNumber"
            class="bg-muted mt-2 inline-flex items-center gap-2 rounded-md px-4 py-2"
            data-testid="order-number"
          >
            <span
              class="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
            >
              {{ t('order_confirmation.order_number') }}:
            </span>
            <span class="text-sm font-semibold">{{ displayOrderNumber }}</span>
          </div>
        </header>

        <!-- Success body -->
        <template v-if="summary">
          <hr class="border-border my-8" />

          <!-- Addresses: Buyer / Billing / Shipping -->
          <section
            v-if="buyerName || billingLines.length || shippingLines.length"
            class="grid gap-6 sm:grid-cols-3"
          >
            <div v-if="buyerName" data-testid="buyer-info">
              <h2 class="mb-1 text-sm font-semibold">
                {{ t('order_confirmation.buyer') }}
              </h2>
              <div class="text-muted-foreground space-y-0.5 text-sm">
                <p>{{ buyerName }}</p>
              </div>
            </div>

            <div v-if="billingLines.length" data-testid="billing-address">
              <h2 class="mb-1 text-sm font-semibold">
                {{ t('order_confirmation.billing_address') }}
              </h2>
              <div class="text-muted-foreground space-y-0.5 text-sm">
                <p v-for="line in billingLines" :key="`b-${line}`">
                  {{ line }}
                </p>
              </div>
            </div>

            <div v-if="shippingLines.length" data-testid="shipping-address">
              <h2 class="mb-1 text-sm font-semibold">
                {{ t('order_confirmation.shipping_address') }}
              </h2>
              <div class="text-muted-foreground space-y-0.5 text-sm">
                <p v-for="line in shippingLines" :key="`s-${line}`">
                  {{ line }}
                </p>
              </div>
            </div>
          </section>

          <hr class="border-border my-8" />

          <!-- Order details header -->
          <div class="mb-4 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <FileText class="size-4" />
              <h2 class="text-base font-semibold">
                {{ t('order_confirmation.order_details') }}
              </h2>
            </div>
            <span
              class="bg-muted rounded-md px-2.5 py-1 text-xs font-medium"
              data-testid="items-total-badge"
            >
              {{ t('order_confirmation.items_total', { count: rows.length }) }}
            </span>
          </div>

          <!-- Item rows -->
          <ul class="divide-border divide-y" data-testid="items-list">
            <li
              v-for="(row, index) in visibleRows"
              :key="row.articleNumber ?? index"
              class="flex items-start justify-between py-3"
            >
              <div class="min-w-0 pr-4">
                <p class="text-sm font-medium">
                  {{ row.product?.name ?? row.name }}
                </p>
                <p
                  v-if="row.articleNumber"
                  class="text-muted-foreground mt-0.5 text-xs"
                >
                  SKU: {{ row.articleNumber }}
                </p>
              </div>
              <div class="shrink-0 text-right">
                <p class="text-sm font-semibold">{{ lineTotal(row) }}</p>
                <p
                  v-if="row.quantity && row.price?.priceIncVatFormatted"
                  class="text-muted-foreground mt-0.5 text-xs"
                >
                  {{ row.quantity }} × {{ lineUnitPrice(row) }}
                </p>
              </div>
            </li>
          </ul>

          <!-- Expand toggle -->
          <button
            v-if="hasMoreRows"
            type="button"
            class="text-primary mt-3 flex w-full items-center justify-center gap-1 text-sm font-medium hover:opacity-80"
            data-testid="toggle-items"
            @click="expanded = !expanded"
          >
            <ChevronDown v-if="!expanded" class="size-4" />
            <ChevronUp v-else class="size-4" />
            {{
              expanded
                ? t('order_confirmation.hide_items')
                : t('order_confirmation.view_all_items', {
                    count: rows.length,
                  })
            }}
          </button>

          <hr class="border-border my-8" />

          <!-- Bottom: reference + payment (left) | summary (right) -->
          <section class="grid items-start gap-6 sm:grid-cols-2">
            <div class="space-y-4">
              <div v-if="reference">
                <p
                  class="text-foreground mb-0.5 text-sm font-semibold"
                  data-testid="reference-label"
                >
                  {{ t('order_confirmation.reference') }}:
                </p>
                <p class="text-muted-foreground text-sm">{{ reference }}</p>
              </div>
              <div v-if="paymentLabel">
                <p class="text-foreground mb-0.5 text-sm font-semibold">
                  {{ t('order_confirmation.payment_method') }}:
                </p>
                <p
                  class="text-muted-foreground text-sm"
                  data-testid="payment-label"
                >
                  {{ paymentLabel }}
                </p>
              </div>
            </div>

            <div
              class="bg-muted space-y-3 rounded-lg p-5"
              data-testid="summary-box"
            >
              <div class="flex items-center justify-between text-sm">
                <span class="text-muted-foreground">{{
                  t('order_confirmation.subtotal')
                }}</span>
                <span data-testid="summary-subtotal">{{
                  summary.total?.itemValueIncVatFormatted
                }}</span>
              </div>
              <div class="flex items-center justify-between text-sm">
                <span class="text-muted-foreground">{{
                  t('order_confirmation.vat')
                }}</span>
                <span data-testid="summary-vat">
                  {{
                    summary.total?.itemValueIncVat != null &&
                    summary.total?.itemValueExVat != null
                      ? (
                          summary.total.itemValueIncVat -
                          summary.total.itemValueExVat
                        ).toLocaleString('sv-SE') +
                        ' ' +
                        (summary.total.currency ?? '')
                      : '-'
                  }}
                </span>
              </div>
              <div
                v-if="hasDiscount"
                class="text-destructive flex items-center justify-between text-sm"
                data-testid="summary-discount"
              >
                <span>{{ t('order_confirmation.discount') }}</span>
                <span class="font-medium"
                  >-{{ summary.total?.discountIncVatFormatted }}</span
                >
              </div>
              <div class="border-border border-t pt-3">
                <div
                  class="flex items-center justify-between text-base font-bold"
                  data-testid="summary-total"
                >
                  <span>{{ t('order_confirmation.total') }}</span>
                  <span>{{ summary.total?.sumFormatted }}</span>
                </div>
              </div>
            </div>
          </section>
        </template>

        <!-- Fallback content shown when summary is null: just the CTA -->

        <!-- Full-width CTA -->
        <NuxtLink
          :to="
            summary?.orderId
              ? localePath(`/portal/orders/${summary.orderId}`)
              : localePath('/portal/orders')
          "
          class="bg-primary text-primary-foreground hover:bg-primary/90 mt-8 flex w-full items-center justify-center rounded-md px-6 py-3 text-sm font-semibold transition-colors"
          data-testid="view-order-cta"
        >
          {{ t('order_confirmation.view_order_in_portal') }}
        </NuxtLink>
      </article>

      <!-- Back to store link below the card -->
      <div class="mt-6 text-center">
        <NuxtLink
          :to="localePath('/')"
          class="text-primary text-sm font-medium hover:opacity-80"
          data-testid="back-to-store"
        >
          &larr; {{ t('order_confirmation.back_to_store') }}
        </NuxtLink>
      </div>
    </template>
  </div>
</template>
