<script setup lang="ts">
import type { SavedList } from '#shared/types/saved-list';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '~/components/ui/sheet';

definePageMeta({ middleware: 'auth' });

const { t } = useI18n();

const { data, pending, error, refresh } = useFetch<{
  lists: SavedList[];
  total: number;
}>('/api/lists', { dedupe: 'defer' });

const searchQuery = ref('');
const sheetOpen = ref(false);
const newListName = ref('');
const newListDescription = ref('');
const isSubmitting = ref(false);

const allLists = computed(() => data.value?.lists ?? []);

const filteredLists = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return allLists.value;
  return allLists.value.filter((list) => list.name?.toLowerCase().includes(q));
});

function openCreateSheet() {
  newListName.value = '';
  newListDescription.value = '';
  sheetOpen.value = true;
}

async function handleCreateList() {
  if (!newListName.value.trim() || isSubmitting.value) return;
  isSubmitting.value = true;
  try {
    await $fetch('/api/lists', {
      method: 'POST',
      body: {
        name: newListName.value.trim(),
        description: newListDescription.value.trim() || undefined,
      },
    });
    sheetOpen.value = false;
    await refresh();
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <PortalShell>
    <!-- Page header -->
    <div
      class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <h2 class="text-xl font-semibold">
        {{ t('portal.saved_lists.title') }}
      </h2>
      <div class="flex items-center gap-3">
        <!-- Search -->
        <Input
          v-model="searchQuery"
          type="search"
          data-testid="saved-lists-search"
          class="w-full sm:w-72"
          :placeholder="t('portal.saved_lists.search_placeholder')"
        />
        <!-- Create button -->
        <Button
          data-testid="saved-lists-create"
          class="bg-green-600 whitespace-nowrap hover:bg-green-700"
          @click="openCreateSheet"
        >
          {{ t('portal.saved_lists.create') }}
        </Button>
      </div>
    </div>

    <!-- Loading state -->
    <div
      v-if="pending"
      data-testid="saved-lists-loading"
      class="text-muted-foreground py-12 text-center text-sm"
    >
      {{ t('common.loading') }}
    </div>

    <!-- Error state -->
    <div
      v-else-if="error"
      data-testid="saved-lists-error"
      class="py-12 text-center"
    >
      <p class="text-muted-foreground mb-4 text-sm">
        {{ t('portal.saved_lists.error_loading') }}
      </p>
      <button
        data-testid="saved-lists-retry"
        class="text-primary hover:text-primary/80 focus-visible:ring-ring rounded text-sm font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        @click="refresh()"
      >
        {{ t('portal.saved_lists.retry') }}
      </button>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!filteredLists.length"
      data-testid="saved-lists-empty"
      class="text-muted-foreground py-12 text-center text-sm"
    >
      {{ t('portal.saved_lists.no_lists') }}
    </div>

    <!-- Lists table -->
    <SavedListsTable v-else :lists="filteredLists" />

    <!-- Create list sheet -->
    <Sheet v-model:open="sheetOpen">
      <SheetContent data-testid="create-list-sheet">
        <SheetHeader>
          <SheetTitle>{{
            t('portal.saved_lists.create_dialog.title')
          }}</SheetTitle>
          <SheetDescription>{{
            t('portal.saved_lists.create_dialog.description')
          }}</SheetDescription>
        </SheetHeader>

        <div class="space-y-4 px-4 py-4">
          <div class="space-y-2">
            <label for="list-name" class="text-sm font-medium">
              {{ t('portal.saved_lists.create_dialog.name_label') }}
            </label>
            <Input
              id="list-name"
              v-model="newListName"
              type="text"
              data-testid="create-list-name"
              :placeholder="
                t('portal.saved_lists.create_dialog.name_placeholder')
              "
            />
          </div>
          <div class="space-y-2">
            <label for="list-description" class="text-sm font-medium">
              {{ t('portal.saved_lists.create_dialog.description_label') }}
            </label>
            <textarea
              id="list-description"
              v-model="newListDescription"
              data-testid="create-list-description"
              class="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              :placeholder="
                t('portal.saved_lists.create_dialog.description_placeholder')
              "
              rows="3"
            />
          </div>
        </div>

        <SheetFooter>
          <Button variant="ghost" @click="sheetOpen = false">
            {{ t('portal.saved_lists.create_dialog.cancel') }}
          </Button>
          <Button
            data-testid="create-list-submit"
            class="bg-green-600 hover:bg-green-700"
            :disabled="!newListName.trim() || isSubmitting"
            @click="handleCreateList"
          >
            {{ t('portal.saved_lists.create_dialog.submit') }}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  </PortalShell>
</template>
