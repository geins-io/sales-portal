<script setup lang="ts">
import type { ProductType, ReviewsResponse } from '#shared/types/commerce';
import { useMediaQuery } from '@vueuse/core';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion';

const props = defineProps<{
  product: ProductType;
  reviews: ReviewsResponse | null;
  reviewsLoading: boolean;
}>();

const emit = defineEmits<{
  'load-reviews': [];
}>();

const isDesktop = useMediaQuery('(min-width: 768px)');

const hasDescription = computed(() => !!props.product.texts?.text1);
const hasSpecs = computed(
  () =>
    !!props.product.parameterGroups && props.product.parameterGroups.length > 0,
);

const reviewsLoaded = ref(false);

function onReviewsActivate() {
  if (!reviewsLoaded.value) {
    reviewsLoaded.value = true;
    emit('load-reviews');
  }
}

function onTabChange(value: string | number) {
  if (String(value) === 'reviews') {
    onReviewsActivate();
  }
}

function onAccordionChange(value: string | string[] | undefined) {
  if (!value) return;
  const values = Array.isArray(value) ? value : [value];
  if (values.includes('reviews')) {
    onReviewsActivate();
  }
}
</script>

<template>
  <div data-testid="product-tabs">
    <!-- Desktop: Tabs -->
    <Tabs
      v-if="isDesktop"
      default-value="description"
      @update:model-value="onTabChange"
    >
      <TabsList>
        <TabsTrigger v-if="hasDescription" value="description">
          Description
        </TabsTrigger>
        <TabsTrigger v-if="hasSpecs" value="specifications">
          Specifications
        </TabsTrigger>
        <TabsTrigger value="reviews"> Reviews </TabsTrigger>
      </TabsList>

      <TabsContent v-if="hasDescription" value="description">
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="prose max-w-none" v-html="product.texts?.text1" />
      </TabsContent>

      <TabsContent v-if="hasSpecs" value="specifications">
        <div class="flex flex-col gap-4">
          <div
            v-for="group in product.parameterGroups"
            :key="group.groupName"
            class="flex flex-col gap-2"
          >
            <h4 class="text-sm font-semibold">{{ group.groupName }}</h4>
            <table class="w-full text-sm" data-testid="spec-table">
              <tbody>
                <tr
                  v-for="param in group.parameters"
                  :key="param.parameterId"
                  class="border-border border-b"
                >
                  <td class="text-muted-foreground py-2 pr-4">
                    {{ param.name ?? param.label ?? '' }}
                  </td>
                  <td class="py-2">{{ param.value }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="reviews">
        <div class="flex flex-col gap-4">
          <div v-if="reviews" class="flex items-center gap-2">
            <span class="text-lg font-semibold">
              {{ reviews.averageRating.toFixed(1) }}
            </span>
            <span class="text-muted-foreground text-sm">
              ({{ reviews.count }} reviews)
            </span>
          </div>
          <div v-if="reviewsLoading" class="text-muted-foreground text-sm">
            Loading reviews...
          </div>
          <template v-else-if="reviews">
            <ProductReviewCard
              v-for="(review, i) in reviews.reviews"
              :key="i"
              :review="review"
            />
          </template>
        </div>
      </TabsContent>
    </Tabs>

    <!-- Mobile: Accordion -->
    <Accordion v-else type="multiple" @update:model-value="onAccordionChange">
      <AccordionItem v-if="hasDescription" value="description">
        <AccordionTrigger>Description</AccordionTrigger>
        <AccordionContent>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="prose max-w-none" v-html="product.texts?.text1" />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem v-if="hasSpecs" value="specifications">
        <AccordionTrigger>Specifications</AccordionTrigger>
        <AccordionContent>
          <div class="flex flex-col gap-4">
            <div
              v-for="group in product.parameterGroups"
              :key="group.groupName"
              class="flex flex-col gap-2"
            >
              <h4 class="text-sm font-semibold">{{ group.groupName }}</h4>
              <table class="w-full text-sm" data-testid="spec-table">
                <tbody>
                  <tr
                    v-for="param in group.parameters"
                    :key="param.parameterId"
                    class="border-border border-b"
                  >
                    <td class="text-muted-foreground py-2 pr-4">
                      {{ param.name ?? param.label ?? '' }}
                    </td>
                    <td class="py-2">{{ param.value }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="reviews">
        <AccordionTrigger>Reviews</AccordionTrigger>
        <AccordionContent>
          <div class="flex flex-col gap-4">
            <div v-if="reviews" class="flex items-center gap-2">
              <span class="text-lg font-semibold">
                {{ reviews.averageRating.toFixed(1) }}
              </span>
              <span class="text-muted-foreground text-sm">
                ({{ reviews.count }} reviews)
              </span>
            </div>
            <div v-if="reviewsLoading" class="text-muted-foreground text-sm">
              Loading reviews...
            </div>
            <template v-else-if="reviews">
              <ProductReviewCard
                v-for="(review, i) in reviews.reviews"
                :key="i"
                :review="review"
              />
            </template>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </div>
</template>
