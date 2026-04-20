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
  if (!safeConfirm(t('portal.saved_list_detail.delete_confirm'))) {
    return;
  }
  await $fetch(`/api/lists/${listId.value}`, { method: 'DELETE' });
  navigateTo(localePath('/portal/lists'));
}

// TODO(M7): wire to cart store addItem per list item once the
// batch-add API exists. See SAL-96.
function addAllToCart() {
  // Stub -- actual cart integration is future scope
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
      <!-- Back link -->
      <NuxtLink
        :to="localePath('/portal/lists')"
        data-testid="back-link"
        class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <Icon name="lucide:arrow-left" class="size-4" />
        {{ t('portal.saved_list_detail.back_to_lists') }}
      </NuxtLink>

      <!-- Action toolbar -->
      <div
        data-testid="saved-list-action-toolbar"
        class="flex flex-wrap items-center justify-end gap-2"
      >
        <Button
          data-testid="delete-list-btn"
          variant="outline"
          class="text-destructive border-destructive/30 hover:bg-destructive/10"
          @click="deleteList"
        >
          <Icon name="lucide:x" class="size-4" />
          {{ t('portal.saved_list_detail.delete_list') }}
        </Button>
        <Button data-testid="add-to-cart-btn" @click="addAllToCart">
          <Icon name="lucide:shopping-cart" class="size-4" />
          {{ t('portal.saved_list_detail.add_to_cart') }}
        </Button>
      </div>

      <!-- Header: list info left, total right -->
      <div
        class="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between"
      >
        <!-- Left: editable name + description -->
        <div class="flex-1 space-y-2">
          <h2 class="text-sm font-medium">
            {{ t('portal.saved_list_detail.list_name_label') }}
          </h2>
          <Input
            v-model="editName"
            data-testid="list-name-input"
            type="text"
            :placeholder="t('portal.saved_list_detail.name_placeholder')"
            class="text-2xl font-semibold"
            @blur="saveListMeta"
          />
          <Input
            v-model="editDescription"
            data-testid="list-description-input"
            type="text"
            :placeholder="t('portal.saved_list_detail.description_placeholder')"
            class="text-sm"
            @blur="saveListMeta"
          />
        </div>

        <!-- Right: total display -->
        <div class="text-right">
          <p class="text-muted-foreground text-sm">
            {{ t('portal.saved_list_detail.list_total_label') }}
          </p>
          <p data-testid="list-total" class="text-2xl font-semibold">
            {{ formatPrice(totalSum) }}
          </p>
          <p class="text-muted-foreground text-xs">
            {{ t('portal.saved_list_detail.total_subtitle') }}
          </p>
        </div>
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
      <div v-else class="border-border overflow-hidden rounded-lg border">
        <table data-testid="list-items-table" class="w-full text-sm">
          <thead class="bg-muted/50">
            <tr>
              <th
                class="text-muted-foreground px-4 py-3 text-left text-xs font-medium"
              >
                {{ t('portal.saved_list_detail.columns.product') }}
              </th>
              <th
                class="text-muted-foreground px-4 py-3 text-left text-xs font-medium"
              >
                {{ t('portal.saved_list_detail.columns.article_number') }}
              </th>
              <th
                class="text-muted-foreground px-4 py-3 text-right text-xs font-medium"
              >
                {{ t('portal.saved_list_detail.columns.price') }}
              </th>
              <th
                class="text-muted-foreground px-4 py-3 text-center text-xs font-medium"
              >
                {{ t('portal.saved_list_detail.columns.quantity') }}
              </th>
              <th
                class="text-muted-foreground px-4 py-3 text-right text-xs font-medium"
              >
                {{ t('portal.saved_list_detail.columns.total') }}
              </th>
              <th class="px-4 py-3 text-right text-xs font-medium" />
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
                  <ProductThumbnail
                    :file-name="item?.imageUrl ?? null"
                    :alt="item?.name ?? ''"
                  />
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
                  <Button
                    data-testid="quantity-decrement"
                    variant="outline"
                    size="icon"
                    class="size-7"
                    :aria-label="
                      t('portal.saved_list_detail.decrease_quantity')
                    "
                    :disabled="item?.quantity <= 1"
                    @click="decrementQuantity(index)"
                  >
                    -
                  </Button>
                  <span
                    data-testid="quantity-display"
                    class="w-8 text-center text-sm"
                  >
                    {{ item?.quantity }}
                  </span>
                  <Button
                    data-testid="quantity-increment"
                    variant="outline"
                    size="icon"
                    class="size-7"
                    :aria-label="
                      t('portal.saved_list_detail.increase_quantity')
                    "
                    @click="incrementQuantity(index)"
                  >
                    +
                  </Button>
                </div>
              </td>
              <td class="px-4 py-3 text-right font-medium">
                {{ formatPrice(item?.unitPrice * item?.quantity) }}
              </td>
              <td class="px-4 py-3 text-right">
                <Button
                  data-testid="delete-item"
                  variant="ghost"
                  size="icon"
                  :aria-label="t('portal.saved_list_detail.remove_item')"
                  class="text-muted-foreground hover:text-destructive"
                  @click="removeItem(index)"
                >
                  <Icon name="lucide:trash-2" class="size-4" />
                </Button>
              </td>
            </tr>
            <!-- Total row -->
            <tr class="bg-muted/30">
              <td
                colspan="4"
                class="px-4 py-3 text-right text-sm font-semibold"
              >
                {{ t('portal.saved_list_detail.total_sum') }}
              </td>
              <td class="px-4 py-3 text-right text-sm font-semibold">
                {{ formatPrice(totalSum) }}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </PortalShell>
</template>
