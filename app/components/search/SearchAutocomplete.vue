<script setup lang="ts">
import type { ProductListResponse } from '#shared/types/commerce';

defineProps<{
  results: ProductListResponse | null;
  loading: boolean;
  open: boolean;
}>();

const emit = defineEmits<{
  'select-product': [alias: string];
  'view-all': [];
  close: [];
}>();

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close');
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div
    v-if="open"
    data-slot="search-autocomplete"
    class="bg-popover text-popover-foreground border-border absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-md border shadow-lg"
  >
    <!-- Loading state -->
    <div v-if="loading" class="flex items-center gap-2 px-4 py-3">
      <Icon
        name="lucide:loader-2"
        class="text-muted-foreground size-4 animate-spin"
      />
      <span class="text-muted-foreground text-sm">{{
        $t('common.loading')
      }}</span>
    </div>

    <!-- Results -->
    <template v-else-if="results && results.products.length > 0">
      <ul role="listbox" class="divide-border divide-y">
        <li
          v-for="product in results.products.slice(0, 5)"
          :key="product.productId"
          role="option"
          class="hover:bg-accent flex cursor-pointer items-center gap-3 px-4 py-2 transition-colors"
          @click="emit('select-product', product.alias)"
        >
          <GeinsImage
            :file-name="product.productImages?.[0]?.fileName ?? ''"
            type="product"
            :alt="product.name"
            class="size-10 shrink-0 rounded"
          />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{{ product.name }}</p>
            <p class="text-muted-foreground truncate text-xs">
              {{ product.brand?.name }}
            </p>
          </div>
          <PriceDisplay :price="product.unitPrice" class="shrink-0 text-sm" />
        </li>
      </ul>

      <!-- View all link -->
      <button
        type="button"
        class="text-primary hover:bg-accent w-full border-t px-4 py-2.5 text-center text-sm font-medium transition-colors"
        @click="emit('view-all')"
      >
        {{ $t('search.view_all_results', { count: results.count }) }}
      </button>
    </template>

    <!-- No results -->
    <div
      v-else-if="results && results.products.length === 0"
      class="text-muted-foreground px-4 py-3 text-center text-sm"
    >
      {{ $t('search.no_results') }}
    </div>
  </div>
</template>
