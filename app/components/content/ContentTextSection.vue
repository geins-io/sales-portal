<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next';

interface Props {
  title?: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

// TODO: Wire to CMS/tenant config
withDefaults(defineProps<Props>(), {
  title: 'Welcome to us',
  description:
    'Follow with one or two sentences that expand on your value proposition and focus on key benefits. Follow with one or two sentences that expand on your value proposition and focus on key benefits. Follow with one or two sentences that expand on your value proposition and focus on key benefits. Follow with one or two sentences that expand on your value proposition and focus on key benefits.',
  ctaLabel: 'Get started',
  ctaHref: '/get-started',
});
</script>

<template>
  <section class="w-full py-10">
    <div class="mx-auto flex w-full max-w-[1280px] justify-center px-6">
      <div class="flex max-w-[672px] flex-col items-center gap-8">
        <!-- Section title -->
        <div class="flex flex-col items-center gap-6 text-center">
          <h2
            class="font-heading text-foreground text-4xl leading-tight font-bold tracking-tight md:text-5xl"
          >
            {{ title }}
          </h2>
          <p class="text-muted-foreground text-lg leading-8">
            {{ description }}
          </p>
        </div>

        <!-- CTA link -->
        <NuxtLink
          :to="ctaHref"
          class="text-foreground hover:text-primary flex items-center gap-2 text-sm underline"
        >
          {{ ctaLabel }}
          <ArrowRight class="text-primary size-4" />
        </NuxtLink>
      </div>
    </div>
  </section>
</template>
