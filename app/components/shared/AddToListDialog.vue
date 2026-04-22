<script setup lang="ts">
import { FAVORITES_LIST_ID } from '@geins/crm';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Checkbox } from '~/components/ui/checkbox';
import { useFavoritesStore } from '~/stores/favorites';

const props = defineProps<{
  open: boolean;
  productAlias: string;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
}>();

const { t } = useI18n();
const store = useFavoritesStore();

// Rows in the picker: favorites first, then all custom lists.
const rows = computed(() => {
  const favorites = store.favorites
    ? {
        id: store.favorites.id,
        name: t('lists.picker.favorites'),
      }
    : {
        id: FAVORITES_LIST_ID,
        name: t('lists.picker.favorites'),
      };
  const customLists = store.lists.map((l) => ({ id: l.id, name: l.name }));
  return [favorites, ...customLists];
});

function isChecked(listId: string): boolean {
  return store.productListIds(props.productAlias).includes(listId);
}

function toggleList(listId: string, checked: boolean) {
  if (checked) {
    store.addItemToList(listId, props.productAlias);
  } else {
    store.removeItemFromList(listId, props.productAlias);
  }
}

// Inline "create new list" flow
const isCreating = ref(false);
const newListName = ref('');

function openCreateForm() {
  isCreating.value = true;
  newListName.value = '';
  nextTick(() => {
    document.getElementById('add-to-list-new-name')?.focus();
  });
}

function cancelCreate() {
  isCreating.value = false;
  newListName.value = '';
}

function submitCreate() {
  const trimmed = newListName.value.trim();
  if (!trimmed) return;
  const created = store.createList(trimmed);
  if (created) {
    store.addItemToList(created.id, props.productAlias);
  }
  cancelCreate();
}

function handleOpenChange(value: boolean) {
  if (!value) {
    cancelCreate();
  }
  emit('update:open', value);
}

function close() {
  handleOpenChange(false);
}
</script>

<template>
  <Dialog :open="props.open" @update:open="handleOpenChange">
    <DialogContent
      data-testid="add-to-list-dialog"
      class="sm:max-w-md"
      @open-auto-focus.prevent
    >
      <DialogHeader>
        <DialogTitle>{{ t('lists.picker.title') }}</DialogTitle>
      </DialogHeader>

      <div class="space-y-2 py-2">
        <label
          v-for="row in rows"
          :key="row.id"
          :for="`add-to-list-row-${row.id}`"
          data-testid="add-to-list-row"
          :data-list-id="row.id"
          class="hover:bg-muted flex cursor-pointer items-center gap-3 rounded-md px-2 py-2"
        >
          <Checkbox
            :id="`add-to-list-row-${row.id}`"
            :model-value="isChecked(row.id)"
            :aria-label="row.name"
            @update:model-value="
              (checked) => toggleList(row.id, checked === true)
            "
          />
          <span class="text-sm font-medium">{{ row.name }}</span>
        </label>

        <div class="border-border border-t pt-2">
          <Button
            v-if="!isCreating"
            variant="ghost"
            class="w-full justify-start gap-2"
            data-testid="add-to-list-create-trigger"
            @click="openCreateForm"
          >
            <Icon name="lucide:plus" class="size-4" />
            {{ t('lists.picker.create_new') }}
          </Button>

          <form
            v-else
            data-testid="add-to-list-create-form"
            class="flex items-center gap-2 px-2 py-1"
            @submit.prevent="submitCreate"
          >
            <Input
              id="add-to-list-new-name"
              v-model="newListName"
              data-testid="add-to-list-new-name"
              :placeholder="t('lists.picker.list_name_placeholder')"
              :aria-label="t('lists.picker.list_name_placeholder')"
              class="flex-1"
            />
            <Button
              type="submit"
              size="sm"
              data-testid="add-to-list-create-submit"
              :disabled="!newListName.trim()"
            >
              {{ t('lists.picker.create') }}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              data-testid="add-to-list-create-cancel"
              @click="cancelCreate"
            >
              {{ t('lists.picker.cancel') }}
            </Button>
          </form>
        </div>
      </div>

      <DialogFooter>
        <Button data-testid="add-to-list-done" @click="close">
          {{ t('lists.picker.done') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
