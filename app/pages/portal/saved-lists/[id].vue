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
import ProductCard, {
  type ProductCardItem,
} from '~/components/shared/ProductCard.vue';
import { useFavoritesStore } from '~/stores/favorites';
import { useCartStore } from '~/stores/cart';

definePageMeta({ middleware: 'auth' });

// Saved-list detail. The list itself is client-side (SDK ListsSession),
// items are product aliases. We fetch fresh product data from
// /api/products/by-aliases and render ProductCards. Add-to-cart and
// remove-from-list are client actions; no server persistence beyond
// the cart itself.

interface ListProduct {
  alias?: string | null;
  name?: string | null;
  articleNumber?: string | null;
  productImages?: Array<{ fileName?: string | null } | null> | null;
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

function mapToCardItem(product: ListProduct): ProductCardItem {
  const unitPrice = product.unitPrice;
  const regular = unitPrice?.regularPriceIncVat ?? null;
  const selling = unitPrice?.sellingPriceIncVat ?? null;
  const hasDiscount =
    unitPrice?.isDiscounted === true ||
    (regular != null && selling != null && regular > selling);

  return {
    name: product.name ?? '',
    imageFileName: product.productImages?.[0]?.fileName ?? null,
    price: hasDiscount
      ? (unitPrice?.regularPriceIncVatFormatted ?? null)
      : (unitPrice?.sellingPriceIncVatFormatted ?? null),
    salePrice: hasDiscount
      ? (unitPrice?.sellingPriceIncVatFormatted ?? null)
      : null,
    articleNumber: product.articleNumber ?? null,
    alias: product.alias ?? null,
  };
}

async function handleAddToCart(
  product: ListProduct,
  { quantity }: { quantity: number },
) {
  const firstSku = product.skus?.find((s) => s?.skuId != null);
  if (!firstSku?.skuId) return;
  await cartStore.addItem(firstSku.skuId, quantity);
}

function removeItem(alias: string | null | undefined) {
  if (!alias) return;
  favoritesStore.removeItemFromList(listId.value, alias);
}

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

// --- Rename ---
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

// --- Delete ---
const deleteOpen = ref(false);

function confirmDelete() {
  favoritesStore.deleteList(listId.value);
  deleteOpen.value = false;
  router.push(localePath('/portal/lists'));
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
      <!-- Back link -->
      <NuxtLink
        :to="localePath('/portal/lists')"
        data-testid="back-link"
        class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <Icon name="lucide:arrow-left" class="size-4" />
        {{ t('portal.saved_list_detail.back_to_lists') }}
      </NuxtLink>

      <!-- Header + actions -->
      <div class="flex flex-wrap items-start justify-between gap-4">
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
            <Icon name="lucide:trash-2" class="size-4" />
            {{ t('portal.saved_list_detail.delete_list') }}
          </Button>
          <Button
            v-if="products.length"
            data-testid="add-all-to-cart-btn"
            :disabled="isAddingAll"
            @click="addAllToCart"
          >
            <Icon name="lucide:shopping-cart" class="size-4" />
            {{ t('portal.saved_list_detail.add_all_to_cart') }}
          </Button>
        </div>
      </div>

      <!-- Empty list -->
      <div
        v-if="!list.items.length"
        data-testid="empty-list"
        class="text-muted-foreground py-12 text-center text-sm"
      >
        {{ t('portal.saved_list_detail.no_items') }}
      </div>

      <!-- Loading -->
      <div
        v-else-if="pending"
        data-testid="list-loading"
        class="text-muted-foreground py-12 text-center text-sm"
      >
        {{ t('common.loading') }}
      </div>

      <!-- Items grid -->
      <div
        v-else
        data-testid="list-items-grid"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div
          v-for="product in products"
          :key="product.alias ?? ''"
          data-testid="list-item-card"
          class="relative"
        >
          <button
            type="button"
            data-testid="list-item-remove"
            :aria-label="t('portal.saved_list_detail.remove_item')"
            class="bg-background/80 hover:bg-background absolute top-2 right-2 z-10 rounded-full p-1.5 shadow"
            @click="removeItem(product.alias)"
          >
            <Icon name="lucide:x" class="size-4" />
          </button>
          <ProductCard
            :product="mapToCardItem(product)"
            variant="grid"
            @add-to-cart="handleAddToCart(product, $event)"
          />
        </div>
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
  </PortalShell>
</template>
