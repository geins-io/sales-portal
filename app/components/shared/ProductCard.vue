<script setup lang="ts">
import type { ProductType, ListProduct } from '#shared/types/commerce';

const props = withDefaults(
  defineProps<{
    product: ProductType | ListProduct;
    variant?: 'grid' | 'list';
  }>(),
  { variant: 'grid' },
);

const firstImage = computed(() => props.product.productImages?.[0]);
const productUrl = computed(
  () => props.product.canonicalUrl || `/p/${props.product.alias}`,
);
</script>

<template>
  <NuxtLink
    :to="productUrl"
    class="group bg-card overflow-hidden rounded-lg border transition-shadow hover:shadow-md"
    :class="variant === 'list' ? 'flex flex-row gap-4' : 'flex flex-col'"
  >
    <!-- Image -->
    <div
      class="bg-muted overflow-hidden"
      :class="variant === 'list' ? 'w-32 shrink-0' : 'aspect-square w-full'"
    >
      <GeinsImage
        v-if="firstImage?.fileName"
        :file-name="firstImage.fileName"
        type="product"
        :alt="product.name || ''"
        loading="lazy"
        class="size-full object-cover transition-transform group-hover:scale-105"
      />
    </div>

    <!-- Content -->
    <div class="flex flex-1 flex-col gap-1.5 p-4">
      <p v-if="product.brand?.name" class="text-muted-foreground text-xs">
        {{ product.brand.name }}
      </p>
      <h3 class="line-clamp-2 text-sm leading-tight font-medium">
        {{ product.name }}
      </h3>
      <PriceDisplay
        v-if="product.unitPrice"
        :price="product.unitPrice"
        class="mt-auto"
      />
      <StockBadge v-if="product.totalStock" :stock="product.totalStock" />
    </div>
  </NuxtLink>
</template>
