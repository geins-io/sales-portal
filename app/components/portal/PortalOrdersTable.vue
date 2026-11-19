<script setup lang="ts">
import type { OrderListItem } from '#shared/types/commerce';
import { Badge } from '~/components/ui/badge';
import {
  getOrderStatusLabel,
  getOrderStatusVariant,
} from '~/utils/order-status';

const { t } = useI18n();
const { formatLocale } = useFormatLocale();
const { timezone } = useTenant();
const { localePath } = useLocaleMarket();
const { showIncVat } = useVatDisplay();
const { showPrice } = usePriceVisibility();

defineProps<{
  orders: Array<
    Pick<OrderListItem, 'id' | 'publicId' | 'status' | 'createdAt'> &
      Partial<Pick<OrderListItem, 'placedBy' | 'orderTotal'>>
  >;
  limit?: number;
}>();

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString(formatLocale.value, {
      ...(timezone.value ? { timeZone: timezone.value } : {}),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function getPlacedBy(order: { placedBy?: string | null }): string {
  // placedBy is the resolved buyer name from the customerId / email
  // join against the CompanyBuyer roster. Orders that cannot be
  // resolved stay unresolved and render "-" rather than falling back
  // to billingAddress, which is the company contact and would show
  // the same wrong name on every such row.
  return order.placedBy || '-';
}

function getTotal(order: Pick<OrderListItem, 'orderTotal'>): string {
  const total = order.orderTotal;
  return (
    (showIncVat.value
      ? total?.sellingPriceIncVatFormatted
      : total?.sellingPriceExVatFormatted) ?? '-'
  );
}

function getOrderLink(order: {
  id?: number | null;
  publicId?: string | null;
}): string {
  const identifier = order.publicId ?? order.id;
  return localePath(`/portal/orders/${identifier}`);
}
</script>

<template>
  <div>
    <!-- Empty state -->
    <div
      v-if="!orders.length"
      data-testid="orders-empty"
      class="text-muted-foreground py-8 text-center text-sm"
    >
      {{ t('portal.overview.no_orders') }}
    </div>

    <!-- One handle for the list, wrapping both responsive shapes below. It
         sits on the `v-else` rather than around the whole component so its
         presence still means "the list has rows" — a wrapper that also
         covered the empty state would match on an empty account and assert
         nothing. -->
    <div v-else data-testid="portal-orders-table">
      <!-- Mobile card view -->
      <div class="space-y-3 md:hidden">
        <NuxtLink
          v-for="order in limit ? orders.slice(0, limit) : orders"
          :key="order.id ?? undefined"
          :to="getOrderLink(order)"
          data-testid="order-row"
          :data-id="order.id"
          class="border-border hover:bg-muted/50 block rounded-lg border p-4 transition-colors"
        >
          <div class="mb-2 flex items-center justify-between">
            <span class="font-medium">#{{ order.id }}</span>
            <Badge :variant="getOrderStatusVariant(order.status)">
              {{ getOrderStatusLabel(order.status, t) }}
            </Badge>
          </div>
          <div class="text-muted-foreground space-y-1 text-sm">
            <div class="flex justify-between">
              <span>{{ formatDate(order.createdAt) }}</span>
              <span
                v-if="showPrice"
                data-testid="order-total"
                class="text-foreground font-medium"
                >{{ getTotal(order) }}</span
              >
            </div>
            <div>{{ getPlacedBy(order) }}</div>
          </div>
        </NuxtLink>
      </div>

      <!-- Desktop table -->
      <table class="hidden w-full text-sm md:table">
        <thead>
          <tr class="border-border border-b text-left">
            <th class="py-3 pr-4 font-medium">
              {{ t('portal.orders.columns.id') }}
            </th>
            <th class="py-3 pr-4 font-medium">
              {{ t('portal.orders.columns.created') }}
            </th>
            <th class="py-3 pr-4 font-medium">
              {{ t('portal.orders.columns.placed_by') }}
            </th>
            <th class="py-3 pr-4 font-medium">
              {{ t('portal.orders.columns.type') }}
            </th>
            <th v-if="showPrice" class="py-3 pr-4 font-medium">
              {{ t('portal.orders.columns.sum') }}
            </th>
            <th class="py-3 pr-4 font-medium">
              {{ t('portal.orders.columns.status') }}
            </th>
            <th class="py-3 font-medium" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="order in limit ? orders.slice(0, limit) : orders"
            :key="order.id ?? undefined"
            data-testid="order-row"
            :data-id="order.id"
            class="border-border hover:bg-muted/50 border-b transition-colors"
          >
            <td class="py-3 pr-4">{{ order.id }}</td>
            <td class="py-3 pr-4">{{ formatDate(order.createdAt) }}</td>
            <td class="py-3 pr-4">{{ getPlacedBy(order) }}</td>
            <td class="py-3 pr-4">{{ t('portal.orders.type_web') }}</td>
            <td v-if="showPrice" data-testid="order-total" class="py-3 pr-4">
              {{ getTotal(order) }}
            </td>
            <td class="py-3 pr-4">
              <Badge :variant="getOrderStatusVariant(order.status)">
                {{ getOrderStatusLabel(order.status, t) }}
              </Badge>
            </td>
            <td class="py-3 text-right">
              <PortalRowAction
                :to="getOrderLink(order)"
                :label="t('portal.orders.view')"
                testid="order-view-link"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
