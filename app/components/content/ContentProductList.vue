<script setup lang="ts">
import { ArrowLeft, ArrowRight } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';

interface Product {
  artNumber: string;
  title: string;
  price: string;
  inStock: boolean;
  imageUrl?: string;
}

interface Props {
  title?: string;
  viewAllHref?: string;
  products?: Product[];
}

// TODO: Wire to CMS/tenant config or product API
const defaultProducts: Product[] = [
  {
    artNumber: 'Art nr. 213798-55B3',
    title: 'Product title',
    price: '$49,99',
    inStock: true,
  },
  {
    artNumber: 'Art nr. 213798-55B3',
    title: 'Product title',
    price: '$49,99',
    inStock: true,
  },
  {
    artNumber: 'Art nr. 213798-55B3',
    title: 'Product title',
    price: '$49,99',
    inStock: true,
  },
  {
    artNumber: 'Art nr. 213798-55B3',
    title: 'Product title',
    price: '$49,99',
    inStock: true,
  },
];

const props = withDefaults(defineProps<Props>(), {
  title: 'Product list title',
  viewAllHref: '/products',
  products: () => [],
});

const displayProducts = computed(() =>
  props.products.length > 0 ? props.products : defaultProducts,
);

// Simple carousel state
const currentPage = ref(0);
const totalPages = 3; // Placeholder for pagination dots

function prevPage() {
  if (currentPage.value > 0) currentPage.value--;
}

function nextPage() {
  if (currentPage.value < totalPages - 1) currentPage.value++;
}
</script>

<template>
  <section class="w-full py-10">
    <div class="mx-auto flex w-full max-w-[1280px] flex-col gap-12 px-6">
      <!-- Header -->
      <div class="flex items-end justify-between">
        <h2
          class="font-heading text-foreground flex-1 text-2xl font-bold tracking-tight"
        >
          {{ title }}
        </h2>
        <Button variant="secondary" size="lg" :as="NuxtLink" :to="viewAllHref">
          View all
        </Button>
      </div>

      <!-- Products grid -->
      <div class="flex flex-col gap-8">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ContentProductCard
            v-for="(product, index) in displayProducts"
            :key="index"
            :art-number="product.artNumber"
            :title="product.title"
            :price="product.price"
            :in-stock="product.inStock"
            :image-url="product.imageUrl"
          />
        </div>

        <!-- Pagination controls -->
        <div class="flex h-10 items-center justify-between py-4">
          <!-- Dots -->
          <div class="flex items-center gap-2">
            <button
              v-for="i in totalPages"
              :key="i"
              class="rounded-full transition-all"
              :class="
                currentPage === i - 1
                  ? 'bg-foreground h-2 w-8'
                  : 'bg-muted-foreground/30 size-2'
              "
              @click="currentPage = i - 1"
            />
          </div>

          <!-- Arrow buttons -->
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              class="size-10 rounded-full"
              :disabled="currentPage === 0"
              @click="prevPage"
            >
              <ArrowLeft class="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              class="size-10 rounded-full"
              :disabled="currentPage === totalPages - 1"
              @click="nextPage"
            >
              <ArrowRight class="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
