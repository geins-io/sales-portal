<script setup lang="ts">
import type { ListProduct } from '#shared/types/commerce';

const props = defineProps<{
  products: ListProduct[];
}>();

const scrollContainer = ref<HTMLElement | null>(null);
const canScrollLeft = ref(false);
const canScrollRight = ref(false);

function updateScrollState() {
  const el = scrollContainer.value;
  if (!el) return;
  canScrollLeft.value = el.scrollLeft > 0;
  canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
}

function scrollBy(direction: 'left' | 'right') {
  const el = scrollContainer.value;
  if (!el) return;
  const amount = direction === 'left' ? -300 : 300;
  el.scrollBy({ left: amount, behavior: 'smooth' });
}

onMounted(() => {
  updateScrollState();
});

const hasProducts = computed(() => props.products.length > 0);
</script>

<template>
  <section v-if="hasProducts" data-testid="related-products">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-lg font-semibold">{{ $t('product.related') }}</h2>
      <div class="hidden gap-1 md:flex">
        <button
          v-show="canScrollLeft"
          type="button"
          class="bg-background hover:bg-muted rounded-full border p-1.5"
          aria-label="Scroll left"
          @click="scrollBy('left')"
        >
          <Icon name="lucide:chevron-left" class="size-4" />
        </button>
        <button
          v-show="canScrollRight"
          type="button"
          class="bg-background hover:bg-muted rounded-full border p-1.5"
          aria-label="Scroll right"
          @click="scrollBy('right')"
        >
          <Icon name="lucide:chevron-right" class="size-4" />
        </button>
      </div>
    </div>

    <div
      ref="scrollContainer"
      class="scrollbar-none flex gap-4 overflow-x-auto"
      @scroll="updateScrollState"
    >
      <div
        v-for="product in products"
        :key="product.productId"
        class="w-56 shrink-0"
      >
        <ProductCard :product="product" />
      </div>
    </div>
  </section>
</template>
