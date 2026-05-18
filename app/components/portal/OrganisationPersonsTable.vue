<script setup lang="ts">
import type { CompanyBuyer } from '#shared/types/company';

// Email, Role and Latest login columns omitted: Geins `getCompany` does
// not expose those fields on `buyers`. Keep the table to data we actually
// have rather than rendering placeholders.

defineProps<{
  buyers: CompanyBuyer[];
}>();

const { t } = useI18n();

function getBuyerName(buyer: CompanyBuyer): string {
  const name = [buyer.firstName, buyer.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  return name || '—';
}

function getBuyerStatusPillClass(active: boolean): string {
  switch (active) {
    case true:
      return 'bg-success/10 text-success';
    case false:
      return 'bg-muted text-muted-foreground';
  }
}
</script>

<template>
  <div data-testid="organisation-persons-table">
    <!-- Empty state -->
    <div
      v-if="buyers.length === 0"
      data-testid="persons-empty"
      class="text-muted-foreground py-12 text-center text-sm"
    >
      {{ t('portal.org.persons.empty') }}
    </div>

    <table v-else class="w-full text-sm">
      <thead>
        <tr class="border-border border-b text-left">
          <th scope="col" class="py-3 pr-4 font-medium">
            {{ t('portal.org.persons.col_id') }}
          </th>
          <th scope="col" class="py-3 pr-4 font-medium">
            {{ t('portal.org.persons.col_name') }}
          </th>
          <th scope="col" class="py-3 pr-4 font-medium">
            {{ t('portal.org.persons.col_phone') }}
          </th>
          <th scope="col" class="py-3 font-medium">
            {{ t('portal.org.persons.col_active') }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="buyer in buyers"
          :key="buyer.id"
          data-testid="buyer-row"
          class="border-border border-b"
        >
          <td class="py-3 pr-4 font-mono text-xs">{{ buyer.id }}</td>
          <td class="py-3 pr-4">{{ getBuyerName(buyer) }}</td>
          <td class="py-3 pr-4">{{ buyer.phone ?? '—' }}</td>
          <td class="py-3">
            <span
              data-testid="buyer-status-pill"
              class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
              :class="getBuyerStatusPillClass(buyer.active)"
            >
              {{
                buyer.active
                  ? t('portal.org.persons.status_active')
                  : t('portal.org.persons.status_inactive')
              }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
