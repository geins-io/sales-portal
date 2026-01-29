<script setup lang="ts">
import { Star, Circle, ShoppingCart, Minus, Plus } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';

interface Props {
  artNumber?: string;
  title?: string;
  price?: string;
  inStock?: boolean;
  imageUrl?: string;
  showFavorite?: boolean;
}

withDefaults(defineProps<Props>(), {
  artNumber: 'Art nr. 213798-55B3',
  title: 'Product title',
  price: '$49,99',
  inStock: true,
  imageUrl: '',
  showFavorite: true,
});

const quantity = ref(1);

function decrement() {
  if (quantity.value > 1) quantity.value--;
}

function increment() {
  quantity.value++;
}
</script>

<template>
  <article
    class="border-border bg-card flex flex-col overflow-hidden rounded-md border"
  >
    <!-- Product image -->
    <div class="bg-muted relative aspect-square overflow-hidden">
      <img
        v-if="imageUrl"
        :src="imageUrl"
        :alt="title"
        class="size-full object-cover"
      />
      <div
        v-else
        class="from-muted to-muted-foreground/10 size-full bg-gradient-to-br"
      />
    </div>

    <!-- Product info -->
    <div class="flex flex-col gap-1 p-4">
      <!-- Art number & favorite -->
      <div class="flex items-start justify-between gap-2">
        <span class="text-muted-foreground flex-1 text-sm">{{
          artNumber
        }}</span>
        <Button
          v-if="showFavorite"
          variant="outline"
          size="icon"
          class="size-8 shrink-0"
        >
          <Star class="size-4" />
        </Button>
      </div>

      <!-- Title -->
      <h3 class="text-card-foreground truncate text-base font-medium">
        {{ title }}
      </h3>

      <!-- Stock status -->
      <div class="flex items-center gap-1">
        <Circle
          class="size-2.5"
          :class="
            inStock
              ? 'fill-green-500 text-green-500'
              : 'fill-red-500 text-red-500'
          "
        />
        <span class="text-muted-foreground text-xs">
          {{ inStock ? 'in stock' : 'out of stock' }}
        </span>
      </div>

      <!-- Price -->
      <p class="text-card-foreground pt-1 text-xl font-semibold">{{ price }}</p>

      <!-- Quantity & Add to cart -->
      <div class="flex items-start gap-3 pt-4">
        <!-- Number stepper -->
        <div class="flex items-center">
          <Button
            variant="outline"
            size="icon"
            class="size-9 rounded-r-none"
            :disabled="quantity <= 1"
            @click="decrement"
          >
            <Minus class="size-4" />
          </Button>
          <div
            class="border-input bg-background flex h-9 w-[76px] items-center justify-center border-y text-sm font-medium"
          >
            {{ quantity }}
          </div>
          <Button
            variant="outline"
            size="icon"
            class="size-9 rounded-l-none"
            @click="increment"
          >
            <Plus class="size-4" />
          </Button>
        </div>

        <!-- Add to cart button -->
        <Button class="h-9 flex-1 gap-2">
          <ShoppingCart class="size-4" />
          <span>Add to cart</span>
        </Button>
      </div>
    </div>
  </article>
</template>
