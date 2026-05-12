<script setup lang="ts">
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import type { StockType } from '#shared/types/commerce';
import { useFavoritesStore } from '~/stores/favorites';
import { useCartStore } from '~/stores/cart';

definePageMeta({ middleware: 'auth' });

// Saved-list detail. The list itself is client-side (SDK ListsSession),
// items are product aliases. We fetch fresh product data from
// /api/products/by-aliases and render a horizontal row list.
// Add-to-cart, add-to-list, and remove-from-list are client actions.

interface ListProduct {
  alias?: string | null;
  name?: string | null;
  articleNumber?: string | null;
  productImages?: Array<{ fileName?: string | null } | null> | null;
  totalStock?: StockType | null;
  unitPrice?: {
    isDiscounted?: boolean | null;
    regularPriceIncVat?: number | null;
    regularPriceIncVatFormatted?: string | null;
    sellingPriceIncVat?: number | null;
    sellingPriceIncVatFormatted?: string | null;
  } | null;
  skus?: Array<{ skuId?: number | null } | null> | null;
}

const { t } = useI18n();
const route = useRoute();
const { localePath } = useLocaleMarket();
const router = useRouter();
const { isCatalogMode } = useTenant();

const favoritesStore = useFavoritesStore();
const cartStore = useCartStore();

const listId = computed(() => route.params.id as string);
const list = computed(() => favoritesStore.getListById(listId.value));

useHead({
  title: computed(() =>
    list.value
      ? `${list.value.name} — ${t('portal.saved_list_detail.title')}`
      : t('portal.saved_list_detail.title'),
  ),
});

const aliasesQuery = computed(() => ({
  aliases: (list.value?.items ?? []).join(','),
}));

const { data, pending, refresh } = useFetch<{ products: ListProduct[] }>(
  '/api/products/by-aliases',
  {
    query: aliasesQuery,
    immediate: false,
    server: false,
    dedupe: 'defer',
  },
);

const products = computed<ListProduct[]>(() => data.value?.products ?? []);

// Per-item quantity tracker
const qty = ref<Record<string, number>>({});

if (import.meta.client) {
  watch(
    () => list.value?.items,
    (items) => {
      if (items && items.length > 0) {
        refresh();
      }
    },
    { immediate: true, deep: true },
  );
}

watch(products, (newProducts) => {
  for (const p of newProducts) {
    if (p.alias) {
      qty.value[p.alias] = qty.value[p.alias] ?? 1;
    }
  }
});

// --- List total ---
const listTotal = computed(() =>
  products.value.reduce(
    (sum, p) => sum + (p.unitPrice?.sellingPriceIncVat ?? 0),
    0,
  ),
);

const listTotalFormatted = computed(() =>
  listTotal.value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
);

// --- Quick search filter ---
const searchQuery = ref('');

const filteredProducts = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return products.value;
  return products.value.filter(
    (p) =>
      p.name?.toLowerCase().includes(q) ||
      p.articleNumber?.toLowerCase().includes(q),
  );
});

// --- Add all to cart ---
const isAddingAll = ref(false);
async function addAllToCart() {
  if (isAddingAll.value || products.value.length === 0) return;
  isAddingAll.value = true;
  try {
    for (const product of products.value) {
      const firstSku = product.skus?.find((s) => s?.skuId != null);
      if (firstSku?.skuId) {
        await cartStore.addItem(firstSku.skuId, 1);
      }
    }
  } finally {
    isAddingAll.value = false;
  }
}

// --- Remove item ---
function removeItem(alias: string | null | undefined) {
  if (!alias) return;
  favoritesStore.removeItemFromList(listId.value, alias);
}

// --- Rename (inline + dialog) ---
const renameOpen = ref(false);
const renameValue = ref('');

function openRename() {
  if (!list.value) return;
  renameValue.value = list.value.name;
  renameOpen.value = true;
}

function commitRename() {
  if (!renameValue.value.trim()) return;
  favoritesStore.renameList(listId.value, renameValue.value.trim());
  renameOpen.value = false;
}

function handleRename() {
  if (!renameValue.value.trim() || renameValue.value === list.value?.name)
    return;
  favoritesStore.renameList(listId.value, renameValue.value.trim());
}

// --- Delete ---
const deleteOpen = ref(false);

function confirmDelete() {
  favoritesStore.deleteList(listId.value);
  deleteOpen.value = false;
  router.push(localePath('/portal/lists'));
}

// --- Add to list dialog ---
const showAddToList = ref(false);
const addToListAlias = ref('');

function openAddToList(alias: string) {
  addToListAlias.value = alias;
  showAddToList.value = true;
}

// --- Qty helpers (typed wrappers to avoid index-signature undefined) ---
function getQty(alias: string | null | undefined): number {
  if (!alias) return 1;
  return qty.value[alias] ?? 1;
}

function setQty(alias: string | null | undefined, value: number) {
  if (!alias) return;
  qty.value[alias] = value;
}

function addToCart(product: ListProduct) {
  const skuId = product.skus?.[0]?.skuId;
  if (!skuId) return;
  cartStore.addItem(skuId, getQty(product.alias));
}
</script>

<template>
  <PortalShell>
    <div v-if="!list" data-testid="list-missing" class="space-y-4 py-12">
      <p class="text-muted-foreground text-center text-sm">
        {{ t('portal.saved_list_detail.not_found') }}
      </p>
      <div class="flex justify-center">
        <NuxtLink :to="localePath('/portal/lists')">
          <Button variant="outline">
            {{ t('portal.saved_list_detail.back_to_lists') }}
          </Button>
        </NuxtLink>
      </div>
    </div>

    <div v-else data-testid="list-detail" class="space-y-6">
      <!-- Back link (outside card) -->
      <NuxtLink
        :to="localePath('/portal/lists')"
        data-testid="back-link"
        class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <Icon name="lucide:arrow-left" class="size-4" />
        {{ t('portal.saved_list_detail.back_to_lists') }}
      </NuxtLink>

      <!-- Card wrapper -->
      <div class="border-border overflow-hidden rounded-lg border">
        <!-- Header row -->
        <div class="flex items-center justify-between p-6">
          <div>
            <h1 data-testid="list-name" class="text-2xl font-semibold">
              {{ list.name }}
            </h1>
            <p
              v-if="list.items.length"
              class="text-muted-foreground mt-1 text-sm"
            >
              {{
                t('portal.saved_list_detail.item_count', {
                  count: list.items.length,
                })
              }}
            </p>
          </div>
          <div
            data-testid="saved-list-action-toolbar"
            class="flex flex-wrap items-center gap-2"
          >
            <Button
              data-testid="rename-list-btn"
              variant="outline"
              @click="openRename"
            >
              <Icon name="lucide:pencil" class="size-4" />
              {{ t('portal.saved_list_detail.rename_list') }}
            </Button>
            <Button
              data-testid="delete-list-btn"
              variant="outline"
              class="text-destructive border-destructive/30 hover:bg-destructive/10"
              @click="deleteOpen = true"
            >
              <Icon name="lucide:x" class="size-4" />
              {{ t('portal.saved_list_detail.delete_list') }}
            </Button>
            <Button
              v-if="products.length && !isCatalogMode"
              data-testid="add-all-to-cart-btn"
              :disabled="isAddingAll"
              @click="addAllToCart"
            >
              <Icon name="lucide:shopping-cart" class="size-4" />
              {{ t('portal.saved_list_detail.add_all_to_cart') }}
            </Button>
          </div>
        </div>

        <!-- Divider row: inline rename input + list total -->
        <div
          class="border-border flex items-center justify-between gap-4 border-t px-6 py-4"
        >
          <Input
            v-model="renameValue"
            class="max-w-xs"
            :placeholder="list.name"
            data-testid="rename-inline-input"
            @blur="
              renameValue !== list.name && renameValue.trim()
                ? handleRename()
                : undefined
            "
          />
          <div
            v-if="products.length > 0"
            class="flex shrink-0 items-center gap-2"
          >
            <span class="text-muted-foreground text-sm">{{
              t('portal.saved_list_detail.list_total_label')
            }}</span>
            <span class="font-semibold">{{ listTotalFormatted }}</span>
          </div>
        </div>

        <!-- Quick search row -->
        <div class="border-border border-t px-6 py-3">
          <Input
            v-model="searchQuery"
            :placeholder="
              t('portal.saved_list_detail.quick_filter_placeholder')
            "
            class="max-w-sm"
            data-testid="list-search-input"
          />
        </div>

        <!-- Empty list -->
        <div
          v-if="!list.items.length"
          data-testid="empty-list"
          class="text-muted-foreground border-border border-t px-6 py-12 text-center text-sm"
        >
          {{ t('portal.saved_list_detail.no_items') }}
        </div>

        <!-- Loading -->
        <div
          v-else-if="pending"
          data-testid="list-loading"
          class="text-muted-foreground border-border border-t px-6 py-12 text-center text-sm"
        >
          {{ t('common.loading') }}
        </div>

        <!-- Items list -->
        <template v-else>
          <div
            v-for="product in filteredProducts"
            :key="product.alias ?? ''"
            data-testid="list-item-row"
            class="border-border flex items-center gap-4 border-t px-6 py-3"
          >
            <ProductThumbnail
              :product="product"
              class="size-10 shrink-0 rounded"
            />

            <!-- Product info -->
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">{{ product.name }}</p>
              <p class="text-muted-foreground text-xs">
                {{ product.articleNumber }}
              </p>
              <StockBadge
                v-if="product.totalStock"
                :stock="product.totalStock"
                class="mt-1"
              />
            </div>

            <!-- Price -->
            <span class="shrink-0 text-sm font-medium">{{
              product.unitPrice?.sellingPriceIncVatFormatted ?? ''
            }}</span>

            <!-- Qty stepper -->
            <QuantityStepper
              v-if="product.alias"
              :model-value="getQty(product.alias)"
              :min="1"
              class="shrink-0"
              @update:model-value="(v) => setQty(product.alias, v)"
            />

            <!-- Add to cart -->
            <Button
              v-if="!isCatalogMode && product.alias"
              variant="ghost"
              size="icon"
              :aria-label="t('portal.saved_list_detail.add_to_cart')"
              data-testid="list-item-add-to-cart"
              @click="addToCart(product)"
            >
              <Icon name="lucide:shopping-cart" class="size-4" />
            </Button>

            <!-- Add to list -->
            <Button
              v-if="product.alias"
              variant="ghost"
              size="icon"
              :aria-label="t('portal.saved_list_detail.add_to_list')"
              data-testid="list-item-add-to-list"
              @click="openAddToList(product.alias)"
            >
              <Icon name="lucide:list-plus" class="size-4" />
            </Button>

            <!-- Remove -->
            <Button
              variant="ghost"
              size="icon"
              class="text-destructive"
              :aria-label="t('portal.saved_list_detail.remove_item')"
              data-testid="list-item-remove"
              @click="removeItem(product.alias)"
            >
              <Icon name="lucide:trash-2" class="size-4" />
            </Button>
          </div>
        </template>
      </div>
    </div>

    <!-- Rename dialog -->
    <Dialog v-model:open="renameOpen">
      <DialogContent data-testid="rename-list-dialog">
        <DialogHeader>
          <DialogTitle>{{
            t('portal.saved_list_detail.rename_list')
          }}</DialogTitle>
          <DialogDescription>{{
            t('portal.saved_list_detail.rename_description')
          }}</DialogDescription>
        </DialogHeader>
        <Input
          v-model="renameValue"
          data-testid="rename-list-input"
          :placeholder="t('portal.saved_lists.create_dialog.name_placeholder')"
          @keydown.enter="commitRename"
        />
        <DialogFooter>
          <Button variant="ghost" @click="renameOpen = false">
            {{ t('portal.saved_lists.create_dialog.cancel') }}
          </Button>
          <Button
            data-testid="rename-list-submit"
            :disabled="!renameValue.trim()"
            @click="commitRename"
          >
            {{ t('portal.saved_list_detail.rename_save') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete confirmation -->
    <Dialog v-model:open="deleteOpen">
      <DialogContent data-testid="delete-list-dialog">
        <DialogHeader>
          <DialogTitle>{{
            t('portal.saved_list_detail.delete_list')
          }}</DialogTitle>
          <DialogDescription>{{
            t('portal.saved_list_detail.delete_confirm')
          }}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" @click="deleteOpen = false">
            {{ t('portal.saved_lists.create_dialog.cancel') }}
          </Button>
          <Button
            data-testid="delete-list-confirm"
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="confirmDelete"
          >
            {{ t('portal.saved_list_detail.delete_list') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Add to list dialog -->
    <AddToListDialog
      v-model:open="showAddToList"
      :product-alias="addToListAlias"
    />
  </PortalShell>
</template>
