<script setup lang="ts">
import type { DetailProduct } from '#shared/types/commerce';

/**
 * The top card every product page opens with: gallery, name, article number,
 * brand. What a product type shows beyond that goes in the slots — `info` for
 * the rest of the middle column, `aside` for the right one.
 */
defineProps<{ product: DetailProduct }>();
</script>

<template>
  <!-- PDP top area: 3-column layout per Figma
         lg+: gallery (max 400) | main info | right card
         md:  gallery + info on first row, right card below
         mobile: stacked single column -->
  <div
    class="bg-card grid gap-6 rounded-lg border p-4 md:p-6 lg:grid-cols-[400px_1fr_265px] lg:gap-10"
    data-testid="pdp-top-area"
  >
    <!-- Left: Gallery -->
    <ErrorBoundary section="product-gallery">
      <ProductGallery
        v-if="product.productImages?.length"
        :images="product.productImages"
        :product-name="product.name ?? ''"
        class="w-full max-w-[400px]"
      />
    </ErrorBoundary>

    <!-- Middle: Product info -->
    <div class="flex flex-col gap-6">
      <!-- Product name + meta -->
      <div class="flex flex-col gap-1">
        <h1
          class="font-heading my-[15px] text-3xl leading-tight font-bold"
          data-testid="product-name"
        >
          {{ product.name }}
        </h1>

        <!-- Article number -->
        <p
          v-if="product.articleNumber"
          class="text-muted-foreground text-[20px]"
          data-testid="product-article-number"
        >
          Art nr. {{ product.articleNumber }}
        </p>

        <!-- Brand -->
        <p
          v-if="product.brand?.name"
          class="text-muted-foreground"
          data-testid="product-brand"
        >
          {{ product.brand.name }}
        </p>
      </div>

      <slot name="info" />
    </div>

    <!-- Right: actions + info card -->
    <aside class="flex flex-col gap-4">
      <slot name="aside" />
    </aside>
  </div>
</template>
