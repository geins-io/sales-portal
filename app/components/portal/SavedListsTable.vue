<script setup lang="ts">
import type { ProductList } from '@geins/crm';
import { useAuthStore } from '~/stores/auth';

const { t } = useI18n();
const { localePath } = useLocaleMarket();
const authStore = useAuthStore();

defineProps<{
  lists: ProductList[];
}>();

// Lists live in the current browser's localStorage, so the only person
// who can have created them is the currently authenticated user. Show
// their display name in the "Created by" column to mirror Figma.
// Falls back to "—" when the auth store hasn't populated yet.
const currentUserName = computed(
  () => authStore.displayName || authStore.user?.username || '—',
);

// SDK ProductList stores `updatedAt` as a numeric epoch (Date.now()),
// not a string. Format defensively in case the SDK shape changes.
function formatDate(value: number | string | undefined): string {
  if (value == null) return '-';
  try {
    return new Date(value).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
}
</script>

<template>
  <div data-testid="saved-lists-table">
    <!-- Mobile card view -->
    <div class="space-y-3 md:hidden">
      <NuxtLink
        v-for="list in lists"
        :key="list.id"
        :to="localePath(`/portal/saved-lists/${list.id}`)"
        data-testid="saved-list-row"
        class="border-border hover:bg-muted/50 block rounded-lg border p-4 transition-colors"
      >
        <div class="mb-1 flex items-center justify-between">
          <span class="font-medium">{{ list.name }}</span>
          <Icon
            name="lucide:chevron-right"
            class="text-muted-foreground size-4"
          />
        </div>
        <div
          class="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm"
        >
          <span>{{ currentUserName }}</span>
          <span>{{ formatDate(list.updatedAt) }}</span>
          <span
            >{{ list.items?.length ?? 0 }}
            {{ t('portal.saved_lists.columns.products').toLowerCase() }}</span
          >
        </div>
      </NuxtLink>
    </div>

    <!-- Desktop table -->
    <table class="hidden w-full text-sm md:table">
      <thead>
        <tr class="border-border border-b text-left">
          <th class="text-muted-foreground py-3 pr-4 font-medium">
            {{ t('portal.saved_lists.columns.name') }}
          </th>
          <th class="text-muted-foreground py-3 pr-4 font-medium">
            {{ t('portal.saved_lists.columns.created_by') }}
          </th>
          <th class="text-muted-foreground py-3 pr-4 font-medium">
            {{ t('portal.saved_lists.columns.modified') }}
          </th>
          <th class="text-muted-foreground py-3 pr-4 font-medium">
            {{ t('portal.saved_lists.columns.products') }}
          </th>
          <th
            class="text-muted-foreground py-3 text-right font-medium"
            aria-label=""
          />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="list in lists"
          :key="list.id"
          data-testid="saved-list-row"
          class="border-border hover:bg-muted/50 border-b transition-colors"
        >
          <td class="py-3 pr-4 font-medium">{{ list.name }}</td>
          <td class="py-3 pr-4">{{ currentUserName }}</td>
          <td class="py-3 pr-4">{{ formatDate(list.updatedAt) }}</td>
          <td class="py-3 pr-4">{{ list.items?.length ?? 0 }}</td>
          <td class="py-3 text-right">
            <NuxtLink
              :to="localePath(`/portal/saved-lists/${list.id}`)"
              class="border-border text-foreground hover:bg-muted inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors"
              data-testid="saved-list-edit"
              :aria-label="t('portal.saved_lists.row_actions.edit')"
            >
              <Icon name="lucide:pencil" class="size-4" />
              {{ t('portal.saved_lists.row_actions.edit') }}
              <Icon name="lucide:chevron-right" class="size-4" />
            </NuxtLink>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
