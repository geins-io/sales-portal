<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';

interface Props {
  tagline?: string;
  title?: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
  backgroundImage?: string;
}

// TODO: Wire to CMS/tenant config
withDefaults(defineProps<Props>(), {
  tagline: 'Hero Section',
  title: 'Banner widget',
  description:
    'Follow with one or two sentences that expand on your value proposition and focus on key benefits.',
  ctaLabel: 'Get started',
  ctaHref: '/get-started',
  backgroundImage: '/images/hero-placeholder.jpg',
});
</script>

<template>
  <section
    class="relative flex min-h-[426px] w-full flex-col items-center justify-center overflow-hidden py-16"
  >
    <!-- Background with overlay -->
    <div class="absolute inset-0 bg-neutral-800">
      <img
        v-if="backgroundImage"
        :src="backgroundImage"
        alt=""
        class="size-full object-cover opacity-50"
      />
      <div class="absolute inset-0 bg-black/60" />
    </div>

    <!-- Content -->
    <div
      class="relative z-10 mx-auto flex w-full max-w-[1280px] flex-col items-center px-6"
    >
      <div class="flex max-w-[672px] flex-col items-center gap-8">
        <!-- Section title -->
        <div class="flex flex-col items-center gap-6 text-center">
          <span class="text-sm font-medium text-white">{{ tagline }}</span>
          <h1
            class="font-heading text-5xl leading-tight font-bold tracking-tight text-white md:text-6xl"
          >
            {{ title }}
          </h1>
          <p class="text-lg leading-8 text-white/80">{{ description }}</p>
        </div>

        <!-- CTA button -->
        <Button :as="NuxtLink" :to="ctaHref" size="default" class="gap-2">
          {{ ctaLabel }}
          <ArrowRight class="size-4" />
        </Button>
      </div>
    </div>
  </section>
</template>
