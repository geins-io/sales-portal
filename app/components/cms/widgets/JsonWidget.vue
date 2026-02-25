<script setup lang="ts">
import type { ContentConfigType } from '#shared/types/cms';

const props = defineProps<{
  data: Record<string, unknown>;
  config: ContentConfigType;
  layout: string;
}>();

const templateId = computed(() => (props.data.templateId as string) ?? '');

const header = computed(
  () =>
    props.data.header as
      | { heading?: string; description?: string; textAlign?: string }
      | undefined,
);
const items = computed(
  () => (props.data.items as Record<string, unknown>[]) ?? [],
);
const textBlock = computed(
  () =>
    props.data.text as { header?: string; description?: string } | undefined,
);
const cta = computed(
  () =>
    props.data.cta as
      | { label?: string; text?: string; url?: string }
      | undefined,
);
const bannerImages = computed(
  () => (props.data.bannerImages as Record<string, unknown>[]) ?? [],
);

function _resolveImageSrc(src: string | undefined): string {
  if (!src) return '';
  // CMS images — use GeinsImage component instead if possible,
  // but JSON widget images use a different path structure
  return src;
}
</script>

<template>
  <!-- Cards Rich: image cards with heading, description, CTA -->
  <div v-if="templateId === 'cards-rich'" class="space-y-6">
    <div
      v-if="header?.heading || header?.description"
      class="space-y-2"
      :class="header?.textAlign === 'center' ? 'text-center' : ''"
    >
      <h2 v-if="header?.heading" class="font-heading text-2xl font-bold">
        {{ header.heading }}
      </h2>
      <p v-if="header?.description" class="text-muted-foreground text-sm">
        {{ header.description }}
      </p>
    </div>
    <div
      class="grid gap-6"
      :class="items.length <= 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'"
    >
      <div
        v-for="(item, i) in items"
        :key="i"
        class="bg-card overflow-hidden rounded-md border"
      >
        <div class="bg-muted aspect-[4/3] overflow-hidden">
          <GeinsImage
            v-if="(item as any).image?.src"
            :file-name="(item as any).image.src"
            type="cms"
            :alt="(item as any).image?.alt ?? ''"
            class="size-full object-cover"
          />
        </div>
        <div class="space-y-2 p-4">
          <h3
            v-if="(item as any).heading"
            class="font-heading text-lg font-semibold"
          >
            {{ (item as any).heading }}
          </h3>
          <p
            v-if="(item as any).description"
            class="text-muted-foreground text-sm"
          >
            {{ (item as any).description }}
          </p>
          <NuxtLink
            v-if="(item as any).cta?.url"
            :to="(item as any).cta.url"
            class="bg-primary text-primary-foreground inline-block rounded-md px-4 py-2 text-sm font-medium"
          >
            {{ (item as any).cta.text }}
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>

  <!-- Cards Simple: image + title + link -->
  <div v-else-if="templateId === 'cards-simple'" class="space-y-6">
    <div v-if="header?.heading || header?.description" class="space-y-2">
      <h2 v-if="header?.heading" class="font-heading text-2xl font-bold">
        {{ header.heading }}
      </h2>
      <p v-if="header?.description" class="text-muted-foreground text-sm">
        {{ header.description }}
      </p>
    </div>
    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <NuxtLink
        v-for="(item, i) in items"
        :key="i"
        :to="(item as any).url ?? '/'"
        class="bg-card group overflow-hidden rounded-md border"
      >
        <div class="bg-muted aspect-square overflow-hidden">
          <GeinsImage
            v-if="(item as any).src"
            :file-name="(item as any).src"
            type="cms"
            :alt="(item as any).alt ?? ''"
            class="size-full object-cover transition-transform group-hover:scale-105"
          />
        </div>
        <p class="p-3 text-center text-sm font-medium">
          {{ (item as any).title }}
        </p>
      </NuxtLink>
    </div>
  </div>

  <!-- Text + CTA: centered text block with call-to-action link -->
  <div
    v-else-if="templateId === 'text-+-cta'"
    class="mx-auto max-w-2xl space-y-4 py-8 text-center"
  >
    <h2 v-if="textBlock?.header" class="font-heading text-2xl font-bold">
      {{ textBlock.header }}
    </h2>
    <p
      v-if="textBlock?.description"
      class="text-muted-foreground text-sm leading-relaxed"
    >
      {{ textBlock.description }}
    </p>
    <NuxtLink
      v-if="cta?.url"
      :to="cta.url"
      class="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-sm font-medium"
    >
      {{ cta.label || cta.text }}
      <Icon name="lucide:arrow-right" class="size-4" />
    </NuxtLink>
  </div>

  <!-- Banner Cards: large banners with overlay text -->
  <div
    v-else-if="templateId === 'banner-cards'"
    class="grid gap-6 md:grid-cols-2"
  >
    <div
      v-for="(banner, i) in bannerImages"
      :key="i"
      class="group relative overflow-hidden rounded-md"
    >
      <GeinsImage
        v-if="(banner as any).image?.src"
        :file-name="(banner as any).image.src"
        type="cms"
        :alt="(banner as any).image?.alt ?? ''"
        class="aspect-[16/9] w-full object-cover"
      />
      <div
        class="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/60 to-transparent p-6"
      >
        <h3
          v-if="(banner as any).text?.title"
          class="text-lg font-semibold text-white"
        >
          {{ (banner as any).text.title }}
        </h3>
        <p
          v-if="(banner as any).text?.byline"
          class="mt-1 text-sm text-white/80"
        >
          {{ (banner as any).text.byline }}
        </p>
        <NuxtLink
          v-if="(banner as any).cta?.url"
          :to="(banner as any).cta.url"
          class="bg-primary text-primary-foreground mt-3 inline-block self-start rounded-md px-4 py-2 text-sm font-medium"
        >
          {{ (banner as any).cta.text }}
        </NuxtLink>
      </div>
    </div>
  </div>

  <!-- Fallback: unknown template -->
  <div
    v-else-if="templateId"
    class="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm"
  >
    Unknown template: {{ templateId }}
  </div>
</template>
