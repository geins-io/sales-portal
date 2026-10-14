<script setup lang="ts">
import type { PortalItemRow } from '#shared/types/portal-rows';
import type { OrderAmounts } from '~/utils/order-view';
import { productPath } from '#shared/utils/route-helpers';

/** An order's rows and totals as a table: the desktop shape of the order. */
defineProps<{
  items: PortalItemRow[];
  amounts: OrderAmounts;
  itemCount: number;
  /** The inc-VAT line's text: each page words it its own way. */
  totalIncVatLabel: string;
}>();

const { t } = useI18n();
const { localePath } = useLocaleMarket();
const { showIncVat } = useVatDisplay();
</script>

<template>
  <div>
    <h3 class="mb-3 text-base font-semibold">
      {{ t('portal.orders.detail.items.title') }}
    </h3>
    <div class="border-border rounded-lg border">
      <table data-testid="order-items-table" class="w-full text-sm">
        <thead class="bg-muted/50">
          <tr>
            <th class="px-4 py-3 text-left font-medium">
              {{ t('portal.orders.detail.items.product') }}
            </th>
            <th class="px-4 py-3 text-left font-medium">
              {{ t('portal.orders.detail.items.article_number') }}
            </th>
            <th class="px-4 py-3 text-right font-medium">
              {{ t('portal.orders.detail.items.quantity') }}
            </th>
            <th class="px-4 py-3 text-right font-medium">
              {{ t('portal.orders.detail.items.unit_price') }}
            </th>
            <th class="px-4 py-3 text-right font-medium">
              {{ t('portal.orders.detail.items.total') }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-border divide-y">
          <tr
            v-for="(item, index) in items"
            :key="item.key"
            :class="{ 'align-top': item.configuration }"
            data-testid="order-item-row"
          >
            <td class="h-24 px-4 py-2">
              <div class="flex items-center gap-3">
                <ProductThumbnail
                  :file-name="item.imageFileName ?? null"
                  :alt="item.name"
                />
                <div>
                  <NuxtLink
                    v-if="item.alias"
                    :to="item.href ?? localePath(productPath(item.alias))"
                    data-testid="order-item-name-link"
                    class="font-medium hover:underline"
                  >
                    {{ item.name }}
                  </NuxtLink>
                  <span
                    v-else
                    data-testid="order-item-name"
                    class="font-medium"
                    >{{ item.name }}</span
                  >
                  <p
                    v-if="item.configuration"
                    data-testid="order-item-configured"
                    class="text-muted-foreground text-xs"
                  >
                    {{ t('cart.configured_product') }}
                  </p>
                </div>
              </div>
              <div v-if="item.configuration" class="mt-2 pl-13">
                <LineSpecification
                  :id="`order-item-configuration-${index}`"
                  :product-name="item.name"
                  :quantity="item.quantity ?? 1"
                  :configuration="item.configuration"
                  :unit-price="item.unitPrice"
                  :total-price="item.totalPrice"
                />
              </div>
            </td>
            <td
              data-testid="order-item-article-number"
              class="text-muted-foreground h-24 px-4 py-2"
            >
              {{ item.articleNumber }}
            </td>
            <td
              data-testid="order-item-quantity"
              class="h-24 px-4 py-2 text-right"
            >
              {{ item.quantity }}
            </td>
            <td
              data-testid="order-item-unit-price"
              class="h-24 px-4 py-2 text-right"
            >
              {{ item.unitPriceFormatted }}
            </td>
            <td
              data-testid="order-item-total-price"
              class="h-24 px-4 py-2 text-right font-medium"
            >
              {{ item.totalPriceFormatted }}
            </td>
          </tr>
        </tbody>
        <tfoot data-testid="order-items-footer" class="border-border border-t">
          <tr>
            <td
              colspan="4"
              class="text-muted-foreground px-4 py-3 text-right text-sm"
            >
              {{
                t('portal.orders.detail.summary.subtotal_with_count', {
                  count: itemCount,
                })
              }}
            </td>
            <td class="px-4 py-3 text-right text-sm">
              {{ amounts.subtotal }}
            </td>
          </tr>
          <tr v-if="amounts.discount">
            <td
              colspan="4"
              class="text-destructive px-4 py-3 text-right text-sm"
            >
              {{ t('discount.discount') }}
            </td>
            <td
              data-testid="order-items-footer-discount"
              class="text-destructive px-4 py-3 text-right text-sm font-medium"
            >
              -{{ amounts.discount }}
            </td>
          </tr>
          <tr v-if="amounts.shipping">
            <td
              colspan="4"
              class="text-muted-foreground px-4 py-3 text-right text-sm"
            >
              {{ t('portal.orders.detail.summary.shipping') }}
            </td>
            <td
              data-testid="order-items-footer-shipping"
              class="px-4 py-3 text-right text-sm"
            >
              {{ amounts.shipping }}
            </td>
          </tr>
          <tr v-if="amounts.paymentFee">
            <td
              colspan="4"
              class="text-muted-foreground px-4 py-3 text-right text-sm"
            >
              {{ t('common.payment_fee') }}
            </td>
            <td
              data-testid="order-items-footer-payment-fee"
              class="px-4 py-3 text-right text-sm"
            >
              {{ amounts.paymentFee }}
            </td>
          </tr>
          <tr>
            <td
              colspan="4"
              class="text-muted-foreground px-4 py-3 text-right text-sm"
            >
              {{ t(showIncVat ? 'common.vat_included' : 'common.vat') }}
            </td>
            <td class="px-4 py-3 text-right text-sm">
              {{ amounts.tax }}
            </td>
          </tr>
          <tr class="border-border border-t">
            <td colspan="4" class="px-4 py-5 text-right text-sm font-semibold">
              {{ t('portal.orders.detail.summary.total') }}
            </td>
            <td
              data-testid="order-items-footer-total"
              class="px-4 py-5 text-right text-sm font-semibold"
            >
              {{ amounts.total }}
            </td>
          </tr>
          <tr v-if="amounts.totalIncVat">
            <td
              colspan="4"
              class="text-muted-foreground px-4 pb-5 text-right text-sm"
            >
              {{ totalIncVatLabel }}
            </td>
            <td
              data-testid="order-items-footer-total-inc-vat"
              class="text-muted-foreground px-4 pb-5 text-right text-sm"
            >
              {{ amounts.totalIncVat }}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
</template>
