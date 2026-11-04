<script setup lang="ts">
import type {
  PortalItemRow,
  SummaryRow,
  SummaryRowKey,
} from '#shared/types/portal-rows';
import { productPath } from '#shared/utils/route-helpers';

/** An order's or a quotation's lines and totals as a table: the desktop shape. */
const props = defineProps<{
  items: PortalItemRow[];
  /** The summary rows, repeated in the footer. */
  rows: SummaryRow[];
  /**
   * Off where the tenant hides prices. The caller decides: a quotation shows
   * its prices whatever the tenant's price visibility.
   */
  showPrices: boolean;
  /** "Order rows" by default. */
  title?: string;
}>();

const { t } = useI18n();
const { localePath } = useLocaleMarket();
const heading = computed(
  () => props.title ?? t('portal.orders.detail.items.title'),
);

interface FooterStyle {
  row?: string;
  label: string;
  value: string;
  /** Whether the value cell carries `order-items-footer-<key>`. */
  testId: boolean;
}
const FOOTER_DEFAULT: FooterStyle = {
  label: 'text-muted-foreground px-4 py-3 text-right text-sm',
  value: 'px-4 py-3 text-right text-sm',
  testId: true,
};
const FOOTER: Partial<Record<SummaryRowKey, FooterStyle>> = {
  subtotal: { ...FOOTER_DEFAULT, testId: false },
  tax: { ...FOOTER_DEFAULT, testId: false },
  discount: {
    label: 'text-danger px-4 py-3 text-right text-sm',
    value: 'text-danger px-4 py-3 text-right text-sm font-medium',
    testId: true,
  },
  total: {
    row: 'border-border border-t',
    label: 'px-4 py-5 text-right text-sm font-semibold',
    value: 'px-4 py-5 text-right text-sm font-semibold',
    testId: true,
  },
  'total-inc-vat': {
    label: 'text-muted-foreground px-4 pb-5 text-right text-sm',
    value: 'text-muted-foreground px-4 pb-5 text-right text-sm',
    testId: true,
  },
};
const footerOf = (key: SummaryRowKey) => FOOTER[key] ?? FOOTER_DEFAULT;
// An object, not `:class`: a bound class renders `class=""` where it has none.
const rowAttrs = (key: SummaryRowKey) => {
  const row = footerOf(key).row;
  return row ? { class: row } : {};
};
</script>

<template>
  <div>
    <h3 class="mb-3 text-base font-semibold">
      {{ heading }}
    </h3>
    <div class="border-border rounded-lg border">
      <table data-testid="order-items-table" class="w-full text-sm">
        <thead class="bg-muted/50">
          <tr>
            <th class="px-4 py-3 text-left font-medium">
              {{ t('portal.quotations.col_item') }}
            </th>
            <th class="px-4 py-3 text-left font-medium">
              {{ t('portal.quotations.col_article') }}
            </th>
            <th class="px-4 py-3 text-right font-medium">
              {{ t('portal.quotations.quantity') }}
            </th>
            <template v-if="showPrices">
              <th class="px-4 py-3 text-right font-medium">
                {{ t('portal.quotations.col_unit_price') }}
              </th>
              <th class="px-4 py-3 text-right font-medium">
                {{ t('portal.quotations.line_total') }}
              </th>
            </template>
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
                  :url="item.imageUrl ?? null"
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
              data-testid="order-item-article-cell"
              class="text-muted-foreground h-24 px-4 py-2"
            >
              <span data-testid="order-item-article-number">{{
                item.articleNumber
              }}</span
              ><span v-if="item.skuName"
                ><template v-if="item.articleNumber"> &bull; </template
                >{{ item.skuName }}</span
              >
            </td>
            <td
              data-testid="order-item-quantity"
              class="h-24 px-4 py-2 text-right"
            >
              {{ item.quantity }}
            </td>
            <template v-if="showPrices">
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
            </template>
          </tr>
        </tbody>
        <tfoot
          v-if="showPrices"
          data-testid="order-items-footer"
          class="border-border border-t"
        >
          <tr v-for="row in rows" :key="row.key" v-bind="rowAttrs(row.key)">
            <td colspan="4" :class="footerOf(row.key).label">
              {{ row.label }}
            </td>
            <td
              :data-testid="
                footerOf(row.key).testId
                  ? `order-items-footer-${row.key}`
                  : undefined
              "
              :class="footerOf(row.key).value"
            >
              {{ row.value }}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
</template>
