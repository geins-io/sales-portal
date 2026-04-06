<script setup lang="ts">
import type { SavedList } from '#shared/types/saved-list';

const { t } = useI18n();
const { localePath } = useLocaleMarket();

defineProps<{
  lists: SavedList[];
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
</script>

<template>
  <div data-testid="saved-lists-table">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-border border-b text-left">
          <th class="py-3 pr-4 font-medium">
            {{ t('portal.saved_lists.columns.name') }}
          </th>
          <th class="py-3 pr-4 font-medium">
            {{ t('portal.saved_lists.columns.created_by') }}
          </th>
          <th class="py-3 pr-4 font-medium">
            {{ t('portal.saved_lists.columns.modified') }}
          </th>
          <th class="py-3 pr-4 font-medium">
            {{ t('portal.saved_lists.columns.products') }}
          </th>
          <th class="py-3 font-medium">
            {{ t('portal.saved_lists.columns.actions') }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="list in lists"
          :key="list.id"
          data-testid="saved-list-row"
          class="border-border hover:bg-muted/50 border-b transition-colors"
        >
          <td class="py-3 pr-4">{{ list.name }}</td>
          <td class="py-3 pr-4">{{ list.createdBy }}</td>
          <td class="py-3 pr-4">{{ formatDate(list.updatedAt) }}</td>
          <td class="py-3 pr-4">{{ list.items?.length ?? 0 }}</td>
          <td class="flex items-center gap-2 py-3">
            <NuxtLink
              :to="localePath(`/portal/saved-lists/${list.id}`)"
              class="text-primary hover:text-primary/80"
              data-testid="saved-list-edit"
            >
              <Icon name="lucide:pencil" class="size-4" />
            </NuxtLink>
            <NuxtLink
              :to="localePath(`/portal/saved-lists/${list.id}`)"
              class="text-primary hover:text-primary/80"
              data-testid="saved-list-view"
            >
              <Icon name="lucide:arrow-right" class="size-4" />
            </NuxtLink>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
