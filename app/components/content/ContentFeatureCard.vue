<script setup lang="ts">
import { Button } from '@/components/ui/button';

interface Props {
  title?: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
  imageUrl?: string;
  variant?: 'default' | 'overlay';
}

withDefaults(defineProps<Props>(), {
  title: 'Feature title',
  description:
    'Shortly describe how this feature solves a specific user problem.',
  ctaLabel: 'Button',
  ctaHref: '#',
  imageUrl: '',
  variant: 'default',
});
</script>

<template>
  <article
    class="border-border bg-card flex min-h-[350px] flex-col overflow-hidden rounded-md border shadow-sm"
    :class="{ 'h-[444px]': variant === 'default' }"
  >
    <!-- Default variant: Image on top -->
    <template v-if="variant === 'default'">
      <!-- Image area -->
      <div class="bg-muted relative flex-1 overflow-hidden">
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

      <!-- Content area -->
      <div class="flex flex-col gap-2 p-6">
        <h3 class="text-card-foreground text-xl font-bold tracking-tight">
          {{ title }}
        </h3>
        <p class="text-muted-foreground text-base leading-6">
          {{ description }}
        </p>
        <Button :as="NuxtLink" :to="ctaHref" size="lg" class="mt-2 w-fit">
          {{ ctaLabel }}
        </Button>
      </div>
    </template>

    <!-- Overlay variant: Text over image -->
    <template v-else>
      <div class="relative flex flex-1 flex-col">
        <div class="bg-muted absolute inset-0 overflow-hidden">
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
        <div class="relative z-10 flex flex-1 flex-col justify-end gap-2 p-6">
          <h3
            class="text-card-foreground text-4xl leading-10 font-bold tracking-tight"
          >
            {{ title }}
          </h3>
          <p class="text-muted-foreground text-base leading-6">
            {{ description }}
          </p>
          <Button :as="NuxtLink" :to="ctaHref" size="lg" class="mt-2 w-fit">
            {{ ctaLabel }}
          </Button>
        </div>
      </div>
    </template>
  </article>
</template>
