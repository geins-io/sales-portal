<script setup lang="ts">
import { Badge } from '~/components/ui/badge';

const { t } = useI18n();
const { localePath } = useLocaleMarket();

defineProps<{
  orders: Array<{
    id?: number | null;
    publicId?: string | null;
    status: string;
    createdAt?: string | null;
    billingAddress?: {
      firstName?: string;
      lastName?: string;
    } | null;
    cart?: {
      summary?: {
        total?: {
          sellingPriceIncVat?: number;
          sellingPriceIncVatFormatted?: string;
        } | null;
      } | null;
    } | null;
  }>;
  limit?: number;
  sortDirection?: 'asc' | 'desc';
}>();

const emit = defineEmits<{
  sort: [column: string];
}>();

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function getPlacedBy(order: {
  billingAddress?: { firstName?: string; lastName?: string } | null;
}): string {
  const addr = order.billingAddress;
  if (!addr) return '-';
  return [addr.firstName, addr.lastName].filter(Boolean).join(' ') || '-';
}

function getStatusVariant(
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status.toLowerCase()) {
    case 'delivered':
    case 'completed':
      return 'default';
    case 'cancelled':
      return 'destructive';
    default:
      return 'secondary';
  }
}

function getStatusKey(status: string): string {
  const key = status.toLowerCase();
  const knownStatuses = [
    'placed',
    'delivered',
    'processing',
    'shipped',
    'cancelled',
  ];
  return knownStatuses.includes(key) ? `portal.orders.status.${key}` : status;
}

function getTotal(order: {
  cart?: {
    summary?: {
      total?: { sellingPriceIncVatFormatted?: string } | null;
    } | null;
  } | null;
}): string {
  return order.cart?.summary?.total?.sellingPriceIncVatFormatted ?? '-';
}

function getOrderLink(order: {
  id?: number | null;
  publicId?: string | null;
}): string {
  const identifier = order.publicId ?? order.id;
  return localePath(`/portal/orders/${identifier}`);
}

function handleSortCreated() {
  emit('sort', 'created');
}
</script>

<template>
  <div data-testid="portal-orders-table">
    <!-- Empty state -->
    <div
      v-if="!orders.length"
      data-testid="orders-empty"
      class="text-muted-foreground py-8 text-center text-sm"
    >
      {{ t('portal.overview.no_orders') }}
    </div>

    <!-- Orders table -->
    <table v-else class="w-full text-sm">
      <thead>
        <tr class="border-border border-b text-left">
          <th class="py-3 pr-4 font-medium">
            {{ t('portal.orders.columns.id') }}
          </th>
          <th
            class="cursor-pointer py-3 pr-4 font-medium select-none"
            data-testid="sort-created"
            @click="handleSortCreated"
          >
            {{ t('portal.orders.columns.created') }}
            <span v-if="sortDirection === 'asc'" class="ml-1">&#9650;</span>
            <span v-else-if="sortDirection === 'desc'" class="ml-1"
              >&#9660;</span
            >
          </th>
          <th class="py-3 pr-4 font-medium">
            {{ t('portal.orders.columns.placed_by') }}
          </th>
          <th class="py-3 pr-4 font-medium">
            {{ t('portal.orders.columns.type') }}
          </th>
          <th class="py-3 pr-4 font-medium">
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
          class="border-border hover:bg-muted/50 border-b transition-colors"
        >
          <td class="py-3 pr-4">{{ order.id }}</td>
          <td class="py-3 pr-4">{{ formatDate(order.createdAt) }}</td>
          <td class="py-3 pr-4">{{ getPlacedBy(order) }}</td>
          <td class="py-3 pr-4">{{ t('portal.orders.type_web') }}</td>
          <td class="py-3 pr-4">{{ getTotal(order) }}</td>
          <td class="py-3 pr-4">
            <Badge :variant="getStatusVariant(order.status)">
              {{ t(getStatusKey(order.status)) }}
            </Badge>
          </td>
          <td class="py-3">
            <NuxtLink
              :to="getOrderLink(order)"
              class="text-primary hover:text-primary/80 text-sm font-medium"
              data-testid="order-view-link"
            >
              {{ t('portal.orders.view') }}
            </NuxtLink>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
