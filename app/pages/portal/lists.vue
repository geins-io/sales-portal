<script setup lang="ts">
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
import { useFavoritesStore } from '~/stores/favorites';

definePageMeta({ middleware: 'auth' });

const { t } = useI18n();
const { localePath } = useLocaleMarket();
const router = useRouter();

// Saved lists are entirely client-side via the SDK ListsSession
// (localStorage). No server API. No persistence beyond the browser.
// See `docs/patterns/lists.md`.
const favoritesStore = useFavoritesStore();
const allLists = computed(() => favoritesStore.lists);

const sheetOpen = ref(false);
const newListName = ref('');
const isSubmitting = ref(false);

function openCreateSheet() {
  newListName.value = '';
  sheetOpen.value = true;
}

function handleCreateList() {
  if (!newListName.value.trim() || isSubmitting.value) return;
  isSubmitting.value = true;
  try {
    const created = favoritesStore.createList(newListName.value.trim());
    sheetOpen.value = false;
    if (created) {
      router.push(localePath(`/portal/saved-lists/${created.id}`));
    }
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <PortalShell>
    <!-- Page header -->
    <div class="mb-6">
      <div
        class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div>
          <h2 class="text-lg font-semibold">
            {{ t('portal.saved_lists.title') }}
          </h2>
          <p class="text-muted-foreground mt-1 text-sm">
            {{ t('portal.saved_lists.subtitle') }}
          </p>
        </div>
        <Button
          data-testid="saved-lists-create"
          class="whitespace-nowrap"
          @click="openCreateSheet"
        >
          <Icon name="lucide:plus" class="size-4" />
          {{ t('portal.saved_lists.create') }}
        </Button>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-if="!allLists.length"
      data-testid="saved-lists-empty"
      class="text-muted-foreground py-12 text-center text-sm"
    >
      {{ t('portal.saved_lists.no_lists') }}
    </div>

    <!-- Lists table -->
    <SavedListsTable v-else :lists="allLists" />

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
              @keydown.enter="handleCreateList"
            />
          </div>
        </div>

        <SheetFooter>
          <Button variant="ghost" @click="sheetOpen = false">
            {{ t('portal.saved_lists.create_dialog.cancel') }}
          </Button>
          <Button
            data-testid="create-list-submit"
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
