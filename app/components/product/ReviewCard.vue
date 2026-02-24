<script setup lang="ts">
import type { ProductReview } from '#shared/types/commerce';

const props = defineProps<{
  review: ProductReview;
}>();

const formattedDate = computed(() => {
  if (!props.review.reviewDate) return '';
  return new Date(props.review.reviewDate).toLocaleDateString();
});
</script>

<template>
  <div class="border-border flex flex-col gap-2 rounded-lg border p-4">
    <div class="flex items-center gap-2">
      <!-- Star rating -->
      <div class="flex gap-0.5" data-testid="star-rating">
        <Icon
          v-for="i in 5"
          :key="i"
          :name="i <= review.rating ? 'lucide:star' : 'lucide:star'"
          class="size-4"
          :class="
            i <= review.rating
              ? 'fill-amber-500 text-amber-500'
              : 'text-muted-foreground'
          "
        />
      </div>
      <span class="text-muted-foreground text-sm">{{ formattedDate }}</span>
    </div>
    <p
      v-if="review.author"
      class="text-sm font-medium"
      data-testid="review-author"
    >
      {{ review.author }}
    </p>
    <p
      v-if="review.comment"
      class="text-muted-foreground text-sm"
      data-testid="review-comment"
    >
      {{ review.comment }}
    </p>
  </div>
</template>
