<script setup lang="ts">
import type { CheckoutSummaryOrderType } from '@geins/types';
import { CircleCheck } from 'lucide-vue-next';

const props = defineProps<{
  summary: CheckoutSummaryOrderType | null;
  isLoading: boolean;
  error: string | null;
}>();

const { t } = useI18n();

const hasDiscount = computed(
  () => (props.summary?.total?.discountIncVat ?? 0) > 0,
);

function formatAddress(
  address: CheckoutSummaryOrderType['billingAddress'],
): string[] {
  if (!address) return [];
  const lines: string[] = [];
  const name = [address.firstName, address.lastName].filter(Boolean).join(' ');
  if (name) lines.push(name);
  if (address.company) lines.push(address.company);
  if (address.addressLine1) lines.push(address.addressLine1);
  if (address.addressLine2) lines.push(address.addressLine2);
  const cityLine = [address.zip, address.city].filter(Boolean).join(' ');
  if (cityLine) lines.push(cityLine);
  if (address.country) lines.push(address.country);
  return lines;
}

const billingLines = computed(() =>
  formatAddress(props.summary?.billingAddress),
);
const shippingLines = computed(() =>
  formatAddress(props.summary?.shippingAddress),
);
</script>

<template>
  <div data-testid="order-confirmation">
    <!-- Loading state -->
    <div
      v-if="isLoading"
      class="space-y-6"
      data-testid="order-confirmation-loading"
    >
      <div class="bg-muted h-24 animate-pulse rounded-lg" />
      <div class="bg-muted h-64 animate-pulse rounded-lg" />
      <div class="bg-muted h-48 animate-pulse rounded-lg" />
    </div>

    <!-- Error state -->
    <div
      v-else-if="error"
      class="flex flex-col items-center gap-4 py-16"
      data-testid="order-confirmation-error"
    >
      <p class="text-destructive text-lg">{{ error }}</p>
      <NuxtLink
        to="/portal/orders"
        class="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-6 py-2.5 text-sm font-medium transition-colors"
      >
        {{ t('order_confirmation.view_orders') }}
      </NuxtLink>
    </div>

    <!-- Success state -->
    <template v-else-if="summary">
      <!-- Thank you banner -->
      <div class="bg-muted mb-8 rounded-lg border p-6 text-center">
        <CircleCheck class="text-primary mx-auto mb-3 size-12" />
        <h1 class="text-2xl font-bold">
          {{ t('order_confirmation.thank_you') }}
        </h1>
        <p class="text-muted-foreground mt-1 text-sm">
          {{ t('order_confirmation.order_placed') }}
        </p>
        <p class="mt-2 text-lg font-semibold" data-testid="order-number">
          {{ t('order_confirmation.order_number') }}: {{ summary.orderId }}
        </p>
      </div>

      <!-- Two-column layout -->
      <div class="flex flex-col gap-8 lg:flex-row lg:items-start">
        <!-- LEFT: Items table -->
        <div class="min-w-0 flex-1">
          <h2 class="mb-4 text-lg font-semibold">
            {{ t('order_confirmation.order_details') }}
          </h2>
          <div class="border-border overflow-x-auto rounded-lg border">
            <table class="w-full text-sm" data-testid="items-table">
              <thead>
                <tr class="bg-muted border-border border-b">
                  <th class="px-4 py-3 text-left font-medium">
                    {{ t('order_confirmation.product') }}
                  </th>
                  <th class="px-4 py-3 text-left font-medium">
                    {{ t('order_confirmation.article_number') }}
                  </th>
                  <th class="px-4 py-3 text-center font-medium">
                    {{ t('order_confirmation.quantity') }}
                  </th>
                  <th class="px-4 py-3 text-right font-medium">
                    {{ t('order_confirmation.unit_price') }}
                  </th>
                  <th class="px-4 py-3 text-right font-medium">
                    {{ t('order_confirmation.line_total') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, index) in summary.rows"
                  :key="row.articleNumber ?? index"
                  class="border-border border-b last:border-b-0"
                >
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                      <img
                        v-if="row.product?.imageUrl"
                        :src="row.product.imageUrl"
                        :alt="row.product?.name ?? row.name ?? ''"
                        class="border-border size-12 rounded border object-cover"
                      />
                      <span class="font-medium">
                        {{ row.product?.name ?? row.name }}
                      </span>
                    </div>
                  </td>
                  <td class="text-muted-foreground px-4 py-3">
                    {{ row.articleNumber }}
                  </td>
                  <td class="px-4 py-3 text-center">
                    {{ row.quantity }}
                  </td>
                  <td class="px-4 py-3 text-right">
                    {{ row.price?.priceIncVatFormatted }}
                  </td>
                  <td class="px-4 py-3 text-right font-medium">
                    {{ row.price?.priceIncVatFormatted }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- RIGHT: Sticky sidebar -->
        <div class="w-full lg:w-80 lg:shrink-0">
          <!-- Summary card -->
          <div
            class="bg-muted border-border sticky top-24 space-y-4 rounded-lg border p-6"
          >
            <h2 class="text-lg font-semibold">
              {{ t('order_confirmation.summary') }}
            </h2>

            <div class="space-y-3">
              <!-- Subtotal -->
              <div class="flex items-center justify-between text-sm">
                <span class="text-muted-foreground">
                  {{ t('order_confirmation.subtotal') }}
                </span>
                <span data-testid="summary-subtotal">
                  {{ summary.total?.itemValueIncVatFormatted }}
                </span>
              </div>

              <!-- Shipping -->
              <div class="flex items-center justify-between text-sm">
                <span class="text-muted-foreground">
                  {{ t('order_confirmation.shipping') }}
                </span>
                <span data-testid="summary-shipping">
                  {{ summary.total?.shippingFeeIncVatFormatted }}
                </span>
              </div>

              <!-- Discount (conditional) -->
              <div
                v-if="hasDiscount"
                class="flex items-center justify-between text-sm"
                data-testid="summary-discount"
              >
                <span class="text-destructive">
                  {{ t('order_confirmation.discount') }}
                </span>
                <span class="text-destructive font-medium">
                  -{{ summary.total?.discountIncVatFormatted }}
                </span>
              </div>
            </div>

            <!-- Divider -->
            <div class="border-border border-t" />

            <!-- Total -->
            <div
              class="flex items-center justify-between font-semibold"
              data-testid="summary-total"
            >
              <span>{{ t('order_confirmation.total') }}</span>
              <span>{{ summary.total?.sumFormatted }}</span>
            </div>
          </div>

          <!-- Invoice Address -->
          <div
            v-if="summary.billingAddress"
            class="border-border mt-4 rounded-lg border p-6"
            data-testid="billing-address"
          >
            <h3 class="mb-2 text-sm font-semibold">
              {{ t('order_confirmation.billing_address') }}
            </h3>
            <div class="text-muted-foreground space-y-0.5 text-sm">
              <p v-for="line in billingLines" :key="line">{{ line }}</p>
            </div>
          </div>

          <!-- Delivery Address -->
          <div
            v-if="summary.shippingAddress"
            class="border-border mt-4 rounded-lg border p-6"
            data-testid="shipping-address"
          >
            <h3 class="mb-2 text-sm font-semibold">
              {{ t('order_confirmation.shipping_address') }}
            </h3>
            <div class="text-muted-foreground space-y-0.5 text-sm">
              <p v-for="line in shippingLines" :key="line">{{ line }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="mt-8 flex flex-wrap justify-center gap-4">
        <NuxtLink
          to="/"
          class="border-border hover:bg-muted rounded-md border px-6 py-2.5 text-sm font-medium transition-colors"
        >
          {{ t('order_confirmation.continue_shopping') }}
        </NuxtLink>
        <NuxtLink
          to="/portal/orders"
          class="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-6 py-2.5 text-sm font-medium transition-colors"
        >
          {{ t('order_confirmation.view_orders') }}
        </NuxtLink>
      </div>
    </template>
  </div>
</template>
