<script setup lang="ts">
import type { WithClassAsProps } from './interface';
import { cn } from '@/lib/utils';
import { useCarousel } from './useCarousel';

const props = defineProps<
  {
    label?: string;
  } & WithClassAsProps
>();

const { scrollSnaps, selectedIndex, scrollTo } = useCarousel();
</script>

<template>
  <div
    v-if="scrollSnaps.length"
    :class="cn('flex items-center justify-center gap-2', props.class)"
    role="group"
    :aria-label="label ?? 'Carousel pagination'"
    data-slot="carousel-dots"
  >
    <button
      v-for="(_, index) in scrollSnaps"
      :key="index"
      type="button"
      data-slot="carousel-dot"
      :aria-selected="index === selectedIndex"
      :data-active="index === selectedIndex || undefined"
      :class="
        cn(
          'h-1.5 w-5 rounded-[4px] transition-colors duration-200 md:w-6',
          index === selectedIndex ? 'bg-accent' : 'bg-muted',
        )
      "
      @click="scrollTo(index)"
    >
      <span class="sr-only">{{
        label ? `${label} ${index + 1}` : `Slide ${index + 1}`
      }}</span>
    </button>
  </div>
</template>
