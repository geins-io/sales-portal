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
import { ListPlus, Search, ShoppingCart, Trash2, X } from 'lucide-vue-next';
import type { StockType } from '#shared/types/commerce';
import { useFavoritesStore } from '~/stores/favorites';
import { useCartStore } from '~/stores/cart';
import { productPath } from '#shared/utils/route-helpers';

definePageMeta({ middleware: ['auth', 'feature'], feature: 'lists' });

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
    regularPriceExVat?: number | null;
    regularPriceExVatFormatted?: string | null;
    sellingPriceIncVat?: number | null;
    sellingPriceIncVatFormatted?: string | null;
    sellingPriceExVat?: number | null;
    sellingPriceExVatFormatted?: string | null;
  } | null;
  skus?: Array<{ skuId?: number | null } | null> | null;
}

const { t } = useI18n();
const route = useRoute();
const { localePath } = useLocaleMarket();
const router = useRouter();
const { isCatalogMode } = useTenant();
const { canAccess } = useFeatureAccess();
const canPurchase = computed(
  () => canAccess('orderPlacement') && !isCatalogMode.value,
);

const favoritesStore = useFavoritesStore();
const cartStore = useCartStore();
const { showIncVat } = useVatDisplay();

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

// --- Per-row price (follows the inc/ex VAT toggle) ---
function rowPriceFormatted(product: ListProduct): string {
  const price = product.unitPrice;
  if (!price) return '';
  return showIncVat.value
    ? (price.sellingPriceIncVatFormatted ?? '')
    : (price.sellingPriceExVatFormatted ?? '');
}

// --- List total (follows the inc/ex VAT toggle) ---
const listTotal = computed(() =>
  products.value.reduce((sum, p) => {
    const selling = showIncVat.value
      ? p.unitPrice?.sellingPriceIncVat
      : p.unitPrice?.sellingPriceExVat;
    return sum + (selling ?? 0);
  }, 0),
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

// --- Rename (inline only — the input itself is the rename UI) ---
const renameValue = ref('');

watchEffect(() => {
  if (list.value && !renameValue.value) {
    renameValue.value = list.value.name;
  }
});

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
    <ClientOnly>
      <template #fallback>
        <div
          class="border-border min-h-[420px] animate-pulse rounded-lg border"
          data-testid="list-detail-skeleton"
        />
      </template>

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

      <div v-else data-testid="list-detail">
        <!-- Card wrapper (matches Figma node 25387:121485) -->
        <div class="border-border overflow-hidden rounded-lg border bg-white">
          <!-- Top row: back link (left) + action buttons (right) -->
          <div class="flex items-center justify-between gap-4 px-6 py-4">
            <NuxtLink
              :to="localePath('/portal/lists')"
              data-testid="back-link"
              class="text-muted-foreground hover:text-foreground text-sm"
            >
              &lt; {{ t('portal.saved_list_detail.back_to_lists') }}
            </NuxtLink>
            <div
              data-testid="saved-list-action-toolbar"
              class="flex shrink-0 items-center gap-2"
            >
              <Button
                data-testid="delete-list-btn"
                variant="outline"
                @click="deleteOpen = true"
              >
                <X class="size-4" />
                {{ t('portal.saved_list_detail.delete_list') }}
              </Button>
              <Button
                v-if="products.length && canPurchase"
                data-testid="add-all-to-cart-btn"
                :disabled="isAddingAll"
                @click="addAllToCart"
              >
                <ShoppingCart class="size-4" />
                {{ t('portal.saved_list_detail.add_all_to_cart') }}
              </Button>
            </div>
          </div>

          <!-- List name + list total -->
          <div
            class="border-border flex items-start justify-between gap-6 border-t p-6"
          >
            <div class="min-w-0 flex-1 space-y-2">
              <label
                for="saved-list-rename"
                class="block text-sm font-semibold"
              >
                {{ t('portal.saved_list_detail.list_name_label') }}
              </label>
              <Input
                id="saved-list-rename"
                v-model="renameValue"
                :placeholder="list.name"
                data-testid="rename-inline-input"
                @blur="
                  renameValue !== list.name && renameValue.trim()
                    ? handleRename()
                    : undefined
                "
              />
              <p class="text-muted-foreground text-sm">
                {{ t('portal.saved_list_detail.list_internal_note') }}
              </p>
            </div>
            <div
              v-if="products.length > 0"
              class="bg-card border-border w-56 shrink-0 rounded-md border p-4"
              data-testid="list-total-card"
            >
              <p class="text-sm font-semibold">
                {{ t('portal.saved_list_detail.list_total_label') }}
              </p>
              <p class="mt-1 text-2xl font-bold">{{ listTotalFormatted }}</p>
              <p class="text-muted-foreground mt-1 text-xs">
                {{ t('portal.saved_list_detail.list_total_caption') }}
              </p>
            </div>
          </div>

          <!-- Quick search row -->
          <div class="border-border border-t px-6 py-4">
            <div class="relative max-w-sm">
              <Search
                class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              />
              <Input
                v-model="searchQuery"
                :placeholder="
                  t('portal.saved_list_detail.quick_filter_placeholder')
                "
                class="pl-9"
                data-testid="list-search-input"
              />
            </div>
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

          <!-- Items list (each row is its own bordered card, image flush-left) -->
          <div v-else class="border-border space-y-3 border-t px-6 py-4">
            <div
              v-for="product in filteredProducts"
              :key="product.alias ?? ''"
              data-testid="list-item-row"
              class="bg-card border-border flex items-stretch overflow-hidden rounded-lg border"
            >
              <!-- Image + info: PDP link when alias is known, plain div otherwise -->
              <NuxtLink
                v-if="product.alias"
                :to="localePath(productPath(product.alias))"
                data-testid="list-item-product-link"
                class="flex flex-1 items-stretch hover:underline focus-visible:underline focus-visible:outline-none"
              >
                <ProductThumbnail
                  :file-name="product.productImages?.[0]?.fileName ?? null"
                  :alt="product.name ?? ''"
                  size="w-20 self-stretch"
                  radius="rounded-none"
                />
                <div class="flex min-w-0 flex-1 items-center px-4 py-3">
                  <div class="min-w-0 flex-1">
                    <p class="truncate font-medium">{{ product.name }}</p>
                    <p class="text-muted-foreground text-xs no-underline">
                      Art nr. {{ product.articleNumber }}
                    </p>
                    <StockBadge
                      v-if="product.totalStock"
                      :stock="product.totalStock"
                      size="sm"
                      class="mt-1"
                    />
                  </div>
                </div>
              </NuxtLink>
              <div v-else class="flex flex-1 items-stretch">
                <ProductThumbnail
                  :file-name="product.productImages?.[0]?.fileName ?? null"
                  :alt="product.name ?? ''"
                  size="w-20 self-stretch"
                  radius="rounded-none"
                />
                <div class="flex min-w-0 flex-1 items-center px-4 py-3">
                  <div class="min-w-0 flex-1">
                    <p class="truncate font-medium">{{ product.name }}</p>
                    <p class="text-muted-foreground text-xs">
                      Art nr. {{ product.articleNumber }}
                    </p>
                    <StockBadge
                      v-if="product.totalStock"
                      :stock="product.totalStock"
                      size="sm"
                      class="mt-1"
                    />
                  </div>
                </div>
              </div>

              <!-- Right side: action row -->
              <div class="flex shrink-0 items-center gap-4 px-4 py-3">
                <!-- Price -->
                <span class="w-28 shrink-0 text-center font-semibold">{{
                  rowPriceFormatted(product)
                }}</span>

                <!-- Qty stepper -->
                <QuantityStepper
                  v-if="product.alias"
                  :model-value="getQty(product.alias)"
                  :min="1"
                  class="shrink-0"
                  @update:model-value="(v) => setQty(product.alias, v)"
                />

                <Button
                  v-if="canPurchase && product.alias"
                  variant="ghost"
                  size="icon"
                  :aria-label="t('portal.saved_list_detail.add_to_cart')"
                  data-testid="list-item-add-to-cart"
                  @click="addToCart(product)"
                >
                  <ShoppingCart class="size-4" />
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
                  <ListPlus class="size-4" />
                </Button>

                <!-- Remove -->
                <Button
                  variant="ghost"
                  size="icon"
                  :aria-label="t('portal.saved_list_detail.remove_item')"
                  data-testid="list-item-remove"
                  @click="removeItem(product.alias)"
                >
                  <Trash2 class="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ClientOnly>

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
