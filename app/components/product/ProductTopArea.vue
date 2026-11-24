<script setup lang="ts">
import type { DetailProduct } from '#shared/types/commerce';

/**
 * The top card every product page opens with: gallery, brand, name, article
 * number. What a product type shows beyond that goes in the slots — `meta` at
 * the end of the brand row, `info` for the rest of the middle column, `aside`
 * for the right one.
 */
const props = defineProps<{
  product: DetailProduct;
  /** The picked SKU's own number, shown in place of the product's. */
  articleNumber?: string | null;
}>();

const shownArticleNumber = computed(
  () => props.articleNumber || props.product.articleNumber,
);

const { t } = useI18n();
</script>

<template>
  <!-- PDP top area: 3-column layout per Figma
         lg+: gallery (max 400) | main info | right card
         md:  gallery + info on first row, right card below
         mobile: stacked single column -->
  <div
    class="bg-card border-card-border grid gap-6 rounded-lg border p-4 md:p-6 lg:grid-cols-[400px_1fr_265px] lg:gap-10"
    data-testid="pdp-top-area"
  >
    <!-- Left: Gallery -->
    <ErrorBoundary section="product-gallery">
      <ProductGallery
        v-if="product.productImages?.length"
        :images="product.productImages"
        :product-name="product.name ?? ''"
        class="w-full max-w-100"
      />
    </ErrorBoundary>

    <!-- Middle: Product info. On mobile the grid's gap under the gallery is
         the space on top. -->
    <div class="flex min-w-0 flex-col gap-4 lg:mt-5">
      <div class="flex flex-col gap-1">
        <!-- Brand, with `meta` (the stock status) kept at the row's end -->
        <div
          v-if="product.brand?.name || $slots.meta"
          class="flex min-h-7 items-center justify-between gap-3"
        >
          <p
            v-if="product.brand?.name"
            class="text-muted-foreground min-w-0 truncate text-xs font-medium tracking-wide uppercase"
            data-testid="product-brand"
          >
            {{ product.brand.name }}
          </p>
          <span v-else />
          <div class="shrink-0"><slot name="meta" /></div>
        </div>

        <h1
          class="font-heading text-2xl leading-tight font-bold wrap-break-word lg:text-3xl"
          data-testid="product-name"
        >
          {{ product.name }}
        </h1>

        <p
          v-if="shownArticleNumber"
          class="text-muted-foreground mt-1 text-sm"
          data-testid="product-article-number"
        >
          {{ t('product.article_number', { number: shownArticleNumber }) }}
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
