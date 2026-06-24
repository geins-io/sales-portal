<script setup lang="ts">
import type { ListProduct } from '#shared/types/commerce';
import type {
  ContentConfigType,
  ProductListWidgetData,
} from '#shared/types/cms';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import {
  Carousel,
  CarouselContent,
  CarouselDots,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '~/components/ui/carousel';

const props = defineProps<{
  data: ProductListWidgetData;
  config: ContentConfigType;
  layout: string;
}>();

const { t } = useI18n();

// Render as a paged slideshow only when the merchant explicitly disabled the
// grid (slideshowDisabled === false). true or undefined fall through to the
// existing responsive grid.
const isSlideshow = computed(() => props.data.slideshowDisabled === false);

const take = computed(() => (props.data.pageCount ?? 1) * 4);

// The CMS payload exposes the curated product selection as `searchParameters`
// which is the same shape Geins's `products(filter: FilterInputType)` query
// accepts (include/exclude/sort/searchText). Forward it verbatim as the
// `filter` query param so the widget renders exactly what the CMS configured
// instead of falling back to "first N products from the catalogue".
const filterParam = computed(() =>
  props.data.searchParameters &&
  Object.keys(props.data.searchParameters).length > 0
    ? JSON.stringify(props.data.searchParameters)
    : undefined,
);

// The product list resolves its language from the request context server-side,
// but the active locale/market must be part of the query so the fetch (and the
// CDN cache) is keyed per locale. Without it the widget reuses the previous
// locale's cached response and shows stale content after a language switch.
const { localeQuery } = useLocaleMarket();

const { data: productsData } = useFetch<{
  products: ListProduct[];
  count: number;
}>('/api/product-lists/products', {
  query: computed(() => ({
    take: take.value,
    skip: 0,
    ...(filterParam.value ? { filter: filterParam.value } : {}),
    ...localeQuery.value,
  })),
  dedupe: 'defer',
  lazy: true,
});

const products = computed(() => productsData.value?.products ?? []);

// The product list arrives after mount via the client-side (lazy) fetch. Embla
// only initialises when its node (the CarouselContent below) is in the DOM at
// the carousel's mount, and embla-carousel-vue never re-initialises if that node
// appears later. So we keep CarouselContent rendered unconditionally and re-init
// Embla once the products land, which recomputes its scroll snaps and lets the
// gated arrows/dots appear. A full reload already works because the products are
// in the SSR payload at mount.
let carouselApi: CarouselApi | undefined;

function onCarouselInit(api: CarouselApi) {
  carouselApi = api;
}

watch(products, async (list) => {
  if (!list.length) return;
  await nextTick();
  carouselApi?.reInit();
});
</script>

<template>
  <div v-if="data.title || products?.length" class="space-y-6">
    <div v-if="data.title" class="flex items-center justify-between">
      <h2 class="font-heading text-2xl font-bold">{{ data.title }}</h2>
    </div>

    <!--
      Slideshow mode. Arrows/dots are gated on the merchant toggle AND the real
      Embla page count at the current viewport (canScrollPrev || canScrollNext),
      not the desktop-centric static pageCount field. With loop:false at least
      one of the slot flags is true iff there is more than one page.
    -->
    <Carousel
      v-if="isSlideshow"
      v-slot="{ canScrollPrev, canScrollNext }"
      :opts="{ slidesToScroll: 'auto', loop: false }"
      :aria-label="t('product_slideshow.region_label')"
      @init-api="onCarouselInit"
    >
      <!--
        Rendered unconditionally (not gated on products) so Embla's node is in
        the DOM when the carousel mounts and initialises. Gating it on the
        client-loaded product list would leave Embla uninitialised whenever the
        widget has a title (the wrapper stays mounted while products load).
      -->
      <CarouselContent>
        <CarouselItem
          v-for="product in products ?? []"
          :key="product.productId"
          class="basis-1/2 md:basis-1/3 lg:basis-1/4"
        >
          <ProductCard :product="product" variant="grid" />
        </CarouselItem>
      </CarouselContent>

      <!--
        Subtle chevrons, not the shared button's filled outline circle. We
        override the shared CarouselPrevious/Next here (ghost variant + a
        Chevron icon + transparent background) instead of restyling the shared
        ui/carousel base, which other carousels would inherit.
      -->
      <template
        v-if="data.displayNavigationArrows && (canScrollPrev || canScrollNext)"
      >
        <CarouselPrevious
          variant="ghost"
          class="text-foreground/70 hover:text-foreground left-2 size-11 hover:bg-transparent"
          :aria-label="t('pagination.previous')"
        >
          <ChevronLeft class="size-6" />
        </CarouselPrevious>
        <CarouselNext
          variant="ghost"
          class="text-foreground/70 hover:text-foreground right-2 size-11 hover:bg-transparent"
          :aria-label="t('pagination.next')"
        >
          <ChevronRight class="size-6" />
        </CarouselNext>
      </template>

      <CarouselDots
        v-if="data.displayNavigationLinks && (canScrollPrev || canScrollNext)"
        class="mt-4"
        :label="t('product_slideshow.go_to_slide_prefix')"
      />
    </Carousel>

    <!-- Grid mode (default): responsive rows of product cards. -->
    <div
      v-else-if="products?.length"
      class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
    >
      <ProductCard
        v-for="product in products"
        :key="product.productId"
        :product="product"
        variant="grid"
      />
    </div>
  </div>
</template>
