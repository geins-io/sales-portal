<script setup lang="ts">
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import type { SavedList, SavedListItem } from '#shared/types/saved-list';

definePageMeta({ middleware: 'auth' });

const { t } = useI18n();
const route = useRoute();
const { localePath } = useLocaleMarket();

const listId = computed(() => route.params.id as string);

const { data, error, pending } = useFetch<SavedList>(
  () => `/api/lists/${listId.value}`,
  { dedupe: 'defer' },
);

useHead({
  title: computed(
    () => `${t('portal.saved_list_detail.title')} - ${editName.value || ''}`,
  ),
});

// Local editable copies
const editName = ref('');
const editDescription = ref('');
const localItems = ref<SavedListItem[]>([]);

// Sync data into local state when fetched
watch(
  data,
  (val) => {
    if (val) {
      editName.value = val.name ?? '';
      editDescription.value = val.description ?? '';
      localItems.value = val.items?.map((item) => ({ ...item })) ?? [];
    }
  },
  { immediate: true },
);

// Handle 404 when list not found
const errorShown = ref(false);
watch(
  [pending, error, data],
  () => {
    if (!errorShown.value && !pending.value && (error.value || !data.value)) {
      errorShown.value = true;
      showError(
        createError({
          statusCode: 404,
          statusMessage: 'List not found',
        }),
      );
    }
  },
  { immediate: true },
);

// Computed total sum
const totalSum = computed(() => {
  return localItems.value.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
});

function formatPrice(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Save list metadata (name/description)
async function saveListMeta() {
  await $fetch(`/api/lists/${listId.value}`, {
    method: 'PUT',
    body: {
      name: editName.value,
      description: editDescription.value,
      items: localItems.value,
    },
  });
}

// Save list items
async function saveListItems() {
  await $fetch(`/api/lists/${listId.value}`, {
    method: 'PUT',
    body: {
      name: editName.value,
      description: editDescription.value,
      items: localItems.value,
    },
  });
}

function incrementQuantity(index: number) {
  const item = localItems.value[index];
  if (item) {
    item.quantity += 1;
    saveListItems();
  }
}

function decrementQuantity(index: number) {
  const item = localItems.value[index];
  if (item && item.quantity > 1) {
    item.quantity -= 1;
    saveListItems();
  }
}

function removeItem(index: number) {
  localItems.value.splice(index, 1);
  saveListItems();
}

async function deleteList() {
  if (!window.confirm(t('portal.saved_list_detail.delete_confirm'))) {
    return;
  }
  await $fetch(`/api/lists/${listId.value}`, { method: 'DELETE' });
  navigateTo(localePath('/portal/lists'));
}

function addAllToCart() {
  // Stub -- actual cart integration is future scope

  console.log('Add all to cart', localItems.value);
}
</script>

<template>
  <PortalShell>
    <!-- Loading -->
    <div
      v-if="pending"
      data-testid="list-loading"
      class="flex items-center justify-center py-16"
    >
      <Icon
        name="lucide:loader-circle"
        class="text-muted-foreground size-8 animate-spin"
      />
    </div>

    <!-- Detail View -->
    <div v-else-if="data" data-testid="list-detail" class="space-y-6">
      <!-- Header -->
      <div>
        <NuxtLink
          :to="localePath('/portal/lists')"
          data-testid="back-link"
          class="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-sm"
        >
          <Icon name="lucide:arrow-left" class="size-4" />
          {{ t('portal.saved_list_detail.back_to_lists') }}
        </NuxtLink>

        <Input
          v-model="editName"
          data-testid="list-name-input"
          type="text"
          :placeholder="t('portal.saved_list_detail.name_placeholder')"
          class="mt-2 text-2xl font-semibold"
          @blur="saveListMeta"
        />
        <textarea
          v-model="editDescription"
          data-testid="list-description-input"
          :placeholder="t('portal.saved_list_detail.description_placeholder')"
          class="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring mt-2 flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          rows="2"
          @blur="saveListMeta"
        />
      </div>

      <!-- Empty list -->
      <div
        v-if="localItems.length === 0"
        data-testid="empty-list"
        class="text-muted-foreground py-12 text-center"
      >
        {{ t('portal.saved_list_detail.empty_list') }}
      </div>

      <!-- Items table -->
      <div v-else class="border-border rounded-lg border">
        <table data-testid="list-items-table" class="w-full text-sm">
          <thead class="bg-muted/50">
            <tr>
              <th class="px-4 py-3 text-left font-medium">
                {{ t('portal.saved_list_detail.columns.product') }}
              </th>
              <th class="px-4 py-3 text-left font-medium">
                {{ t('portal.saved_list_detail.columns.article_number') }}
              </th>
              <th class="px-4 py-3 text-right font-medium">
                {{ t('portal.saved_list_detail.columns.price') }}
              </th>
              <th class="px-4 py-3 text-center font-medium">
                {{ t('portal.saved_list_detail.columns.quantity') }}
              </th>
              <th class="px-4 py-3 text-right font-medium">
                {{ t('portal.saved_list_detail.columns.total') }}
              </th>
              <th class="px-4 py-3 text-right font-medium">
                {{ t('portal.saved_list_detail.columns.actions') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-border divide-y">
            <tr
              v-for="(item, index) in localItems"
              :key="item?.id"
              data-testid="list-item-row"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <div class="size-10 shrink-0 overflow-hidden rounded">
                    <GeinsImage
                      v-if="item?.imageUrl"
                      :file-name="item?.imageUrl"
                      type="product"
                      :alt="item?.name ?? ''"
                      aspect-ratio="1"
                      sizes="40px"
                    />
                    <div
                      v-else
                      class="bg-muted flex size-full items-center justify-center"
                    >
                      <Icon
                        name="lucide:image-off"
                        class="text-muted-foreground size-4"
                      />
                    </div>
                  </div>
                  <span class="font-medium">{{ item?.name }}</span>
                </div>
              </td>
              <td class="text-muted-foreground px-4 py-3">
                {{ item?.articleNumber }}
              </td>
              <td class="px-4 py-3 text-right">
                {{ item?.unitPriceFormatted }}
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-center gap-1">
                  <button
                    data-testid="quantity-decrement"
                    :aria-label="
                      t('portal.saved_list_detail.decrease_quantity')
                    "
                    class="border-border hover:bg-muted focus-visible:ring-ring inline-flex size-7 items-center justify-center rounded border text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    :disabled="item?.quantity <= 1"
                    @click="decrementQuantity(index)"
                  >
                    -
                  </button>
                  <span
                    data-testid="quantity-display"
                    class="w-8 text-center text-sm"
                  >
                    {{ item?.quantity }}
                  </span>
                  <button
                    data-testid="quantity-increment"
                    :aria-label="
                      t('portal.saved_list_detail.increase_quantity')
                    "
                    class="border-border hover:bg-muted focus-visible:ring-ring inline-flex size-7 items-center justify-center rounded border text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    @click="incrementQuantity(index)"
                  >
                    +
                  </button>
                </div>
              </td>
              <td class="px-4 py-3 text-right font-medium">
                {{ formatPrice(item?.unitPrice * item?.quantity) }}
              </td>
              <td class="px-4 py-3 text-right">
                <button
                  data-testid="delete-item"
                  :aria-label="t('portal.saved_list_detail.remove_item')"
                  class="text-muted-foreground hover:text-destructive focus-visible:ring-ring inline-flex items-center justify-center rounded focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  @click="removeItem(index)"
                >
                  <Icon name="lucide:trash-2" class="size-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Footer -->
      <div
        v-if="localItems.length > 0"
        class="flex flex-wrap items-center justify-between gap-4"
      >
        <div data-testid="list-total" class="text-lg font-semibold">
          {{ t('portal.saved_list_detail.total_sum') }}:
          {{ formatPrice(totalSum) }}
        </div>
        <div class="flex gap-2">
          <Button
            data-testid="delete-list-btn"
            variant="destructive"
            @click="deleteList"
          >
            {{ t('portal.saved_list_detail.delete_list') }}
          </Button>
          <Button
            data-testid="add-to-cart-btn"
            class="bg-green-600 text-white hover:bg-green-700"
            @click="addAllToCart"
          >
            {{ t('portal.saved_list_detail.add_to_cart') }}
          </Button>
        </div>
      </div>
    </div>
  </PortalShell>
</template>
