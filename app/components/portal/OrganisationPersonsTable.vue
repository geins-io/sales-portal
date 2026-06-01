<script setup lang="ts">
import type { CompanyBuyer } from '#shared/types/company';

defineProps<{
  buyers: CompanyBuyer[];
}>();

const { t } = useI18n();
</script>

<template>
  <div data-testid="organisation-persons-table">
    <div
      v-if="buyers.length === 0"
      data-testid="persons-empty"
      class="text-muted-foreground py-12 text-center text-sm"
    >
      {{ t('portal.org.persons.empty') }}
    </div>

    <div v-else class="border-border overflow-hidden rounded-lg border">
      <table class="w-full text-sm">
        <thead class="border-border border-b">
          <tr class="text-left">
            <th scope="col" class="px-4 py-4 font-medium">
              {{ t('portal.org.persons.col_id') }}
            </th>
            <th scope="col" class="px-4 py-4 font-medium">
              {{ t('portal.org.persons.col_email') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="buyer in buyers"
            :key="buyer.id"
            data-testid="buyer-row"
            class="border-border [&:not(:last-child)]:border-b"
          >
            <td class="px-4 py-5">{{ buyer.internalId ?? '-' }}</td>
            <td class="px-4 py-5">{{ buyer.id }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
