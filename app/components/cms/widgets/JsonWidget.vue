<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next';
import type { ContentConfigType, FormWidgetData } from '#shared/types/cms';
import { NuxtLink } from '#components';
import { normalizeMenuUrl } from '#shared/utils/menu';
import FormWidget from '~/components/cms/widgets/FormWidget.vue';
import {
  Carousel,
  CarouselContent,
  CarouselDots,
  CarouselItem,
  type CarouselApi,
} from '~/components/ui/carousel';

// ---------- Widget-internal types ----------

interface JsonWidgetImage {
  src?: string;
  /** Asset library path of `src`, e.g. `content/banner4.jpg`. */
  srcPath?: string | null;
  alt?: string;
}

interface JsonWidgetCta {
  url?: string;
  text?: string;
  label?: string;
  /** `{horizontal}-{vertical}` overlay placement, e.g. "left-bottom", "middle-center". */
  placement?: string;
}

interface CardsRichItem {
  heading?: string;
  description?: string;
  image?: JsonWidgetImage;
  cta?: JsonWidgetCta;
}

interface CardsSimpleItem {
  title?: string;
  url?: string;
  src?: string;
  srcPath?: string | null;
  alt?: string;
}

interface BannerCardItem {
  image?: JsonWidgetImage;
  text?: { title?: string; byline?: string };
  cta?: JsonWidgetCta;
}

// ---------- Props & computed ----------

const props = defineProps<{
  data: Record<string, unknown>;
  config: ContentConfigType;
  layout: string;
  // "Mobile behavior = Collapse" on the parent CMS block. When set, the
  // cards-rich / cards-simple item grids become a horizontal swipe slider on
  // mobile with indicator dots, while the header above stays fixed; desktop keeps
  // the grid (this is a mobile-only setting). Absent for every Stack block.
  collapse?: boolean;
  // The page's first widget. Its first card image gets priority, except in a
  // collapse slider, which renders every card twice (slider and grid).
  priority?: boolean;
}>();

const templateId = computed(() => (props.data.templateId as string) ?? '');

const header = computed(
  () =>
    props.data.header as
      | { heading?: string; description?: string; textAlign?: string }
      | undefined,
);
const items = computed(() => (props.data.items as CardsRichItem[]) ?? []);
const simpleItems = computed(
  () => (props.data.items as CardsSimpleItem[]) ?? [],
);
const textBlock = computed(
  () =>
    props.data.text as { header?: string; description?: string } | undefined,
);
const cta = computed(() => props.data.cta as JsonWidgetCta | undefined);
const bannerImages = computed(
  () => (props.data.bannerImages as BannerCardItem[]) ?? [],
);

const { localePath } = useLocaleMarket();
const currentHost = useRequestURL().host;

/** '' when the url is missing or its scheme is unsafe: the content renders unlinked. */
function linkTo(url: string | undefined): string {
  const path = normalizeMenuUrl(url, currentHost);
  return path ? localePath(path) : '';
}

// Collapse slider plumbing (cards-rich / cards-simple). Re-init Embla when the
// item set changes so dots and scroll snaps recompute (the items swap on a
// locale/CMS payload change). Embla's own resize observer handles the
// desktop->mobile reveal of the `md:hidden` track. Mirrors ProductListWidget.
// ponytail: the card markup is duplicated (carousel item + grid cell) so mobile
// can swipe while desktop keeps the grid. Presentational only, no data fetch, so
// the double render is cheap; revisit only if a card ever fetches.
let carouselApi: CarouselApi | undefined;
function onCarouselInit(api: CarouselApi) {
  carouselApi = api;
}
watch(
  () => props.data.items,
  async () => {
    await nextTick();
    carouselApi?.reInit();
  },
);

function isFormWidgetData(data: unknown): data is FormWidgetData {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return typeof d['sendFormToEmail'] === 'string' && Array.isArray(d['fields']);
}

const formWidgetData = computed<FormWidgetData | null>(() =>
  isFormWidgetData(props.data) ? props.data : null,
);

function _resolveImageSrc(src: string | undefined): string {
  if (!src) return '';
  // CMS images, use GeinsImage component instead if possible,
  // but JSON widget images use a different path structure
  return src;
}

/**
 * Banner-cards overlay placement. The CMS stores each banner's position as a
 * `{horizontal}-{vertical}` string (e.g. "left-bottom", "middle-center"). Map
 * it onto the flex-column overlay: vertical via justify-*, horizontal via
 * items-* plus text-* so multi-line copy aligns too. Falls back to bottom-left
 * (the historical hardcoded position) when the field is absent or unrecognised.
 */
function bannerPlacementClasses(placement?: string): string {
  const [horizontal, vertical] = (placement ?? '').toLowerCase().split('-');

  const verticalClass =
    vertical === 'top'
      ? 'justify-start'
      : vertical === 'center' || vertical === 'middle'
        ? 'justify-center'
        : 'justify-end';

  const horizontalClass =
    horizontal === 'middle' || horizontal === 'center'
      ? 'items-center text-center'
      : horizontal === 'right'
        ? 'items-end text-right'
        : 'items-start text-left';

  return `${verticalClass} ${horizontalClass}`;
}
</script>

<template>
  <FormWidget
    v-if="formWidgetData"
    :data="formWidgetData"
    :config="config"
    :layout="layout"
  />

  <!-- Cards Rich: image cards with heading, description, CTA -->
  <div v-else-if="templateId === 'cards-rich'" class="space-y-6">
    <div
      v-if="header?.heading || header?.description"
      class="mx-auto max-w-[670px] space-y-2"
      :class="header?.textAlign === 'center' ? 'text-center' : ''"
    >
      <h2
        v-if="header?.heading"
        class="font-heading text-[32px] leading-[1.1] font-bold md:text-[40px]"
      >
        {{ header.heading }}
      </h2>
      <p v-if="header?.description" class="text-muted-foreground text-sm">
        {{ header.description }}
      </p>
    </div>

    <!-- Collapse: mobile-only horizontal slider; the header above stays fixed. -->
    <Carousel
      v-if="collapse"
      v-slot="{ canScrollPrev, canScrollNext }"
      class="md:hidden"
      :opts="{ slidesToScroll: 'auto', loop: false }"
      @init-api="onCarouselInit"
    >
      <CarouselContent>
        <CarouselItem
          v-for="(item, i) in items"
          :key="`rich-slide-${i}`"
          class="basis-4/5"
        >
          <div class="bg-card h-full overflow-hidden rounded-md border">
            <GeinsImage
              v-if="item.image?.src"
              :file-name="item.image.src"
              :path="item.image.srcPath"
              type="pagewidget"
              :alt="item.image?.alt ?? ''"
              fit="natural"
              sizes="80vw"
              class="w-full"
            />
            <div class="space-y-2 p-4">
              <h3
                v-if="item.heading"
                class="font-heading text-lg font-semibold"
              >
                {{ item.heading }}
              </h3>
              <p v-if="item.description" class="text-muted-foreground text-sm">
                {{ item.description }}
              </p>
              <NuxtLink
                v-if="item.cta && linkTo(item.cta.url)"
                :to="linkTo(item.cta.url)"
                class="bg-button-background text-primary-foreground inline-block rounded-md px-4 py-2 text-sm font-medium"
              >
                {{ item.cta.text }}
              </NuxtLink>
            </div>
          </div>
        </CarouselItem>
      </CarouselContent>
      <CarouselDots v-if="canScrollPrev || canScrollNext" class="mt-4" />
    </Carousel>

    <!-- Grid: all viewports when Stack; desktop-only when Collapse (slider owns mobile). -->
    <div
      class="gap-6"
      :class="[
        items.length <= 2 ? 'md:grid-cols-2' : 'md:grid-cols-3',
        collapse ? 'hidden md:grid' : 'grid',
      ]"
    >
      <div
        v-for="(item, i) in items"
        :key="i"
        class="bg-card overflow-hidden rounded-md border"
      >
        <GeinsImage
          v-if="item.image?.src"
          :file-name="item.image.src"
          :path="item.image.srcPath"
          type="pagewidget"
          :alt="item.image?.alt ?? ''"
          fit="natural"
          :priority="priority && !collapse && i === 0"
          sizes="(min-width: 768px) 50vw, 100vw"
          class="w-full"
        />
        <div class="space-y-2 p-4">
          <h3 v-if="item.heading" class="font-heading text-lg font-semibold">
            {{ item.heading }}
          </h3>
          <p v-if="item.description" class="text-muted-foreground text-sm">
            {{ item.description }}
          </p>
          <NuxtLink
            v-if="item.cta && linkTo(item.cta.url)"
            :to="linkTo(item.cta.url)"
            class="bg-button-background text-primary-foreground inline-block rounded-md px-4 py-2 text-sm font-medium"
          >
            {{ item.cta.text }}
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

    <!-- Collapse: mobile-only horizontal slider; the header above stays fixed. -->
    <Carousel
      v-if="collapse"
      v-slot="{ canScrollPrev, canScrollNext }"
      class="md:hidden"
      :opts="{ slidesToScroll: 'auto', loop: false }"
      @init-api="onCarouselInit"
    >
      <CarouselContent>
        <CarouselItem
          v-for="(item, i) in simpleItems"
          :key="`simple-slide-${i}`"
          class="basis-4/5"
        >
          <component
            :is="linkTo(item.url ?? '/') ? NuxtLink : 'div'"
            :to="linkTo(item.url ?? '/') || undefined"
            class="bg-card group block overflow-hidden rounded-md border"
          >
            <div class="bg-muted aspect-square overflow-hidden">
              <GeinsImage
                v-if="item.src"
                :file-name="item.src"
                :path="item.srcPath"
                type="pagewidget"
                :alt="item.alt ?? ''"
                sizes="80vw"
                aspect-ratio="1"
                class="size-full object-cover transition-transform group-hover:scale-105"
              />
            </div>
            <p class="font-heading p-3 text-center text-base font-medium">
              {{ item.title }}
            </p>
          </component>
        </CarouselItem>
      </CarouselContent>
      <CarouselDots v-if="canScrollPrev || canScrollNext" class="mt-4" />
    </Carousel>

    <!-- Grid: all viewports when Stack; desktop-only when Collapse. -->
    <div
      class="gap-6 sm:grid-cols-2 lg:grid-cols-4"
      :class="collapse ? 'hidden md:grid' : 'grid'"
    >
      <component
        :is="linkTo(item.url ?? '/') ? NuxtLink : 'div'"
        v-for="(item, i) in simpleItems"
        :key="i"
        :to="linkTo(item.url ?? '/') || undefined"
        class="bg-card group overflow-hidden rounded-md border"
      >
        <div class="bg-muted aspect-square overflow-hidden">
          <GeinsImage
            v-if="item.src"
            :file-name="item.src"
            :path="item.srcPath"
            type="pagewidget"
            :alt="item.alt ?? ''"
            :priority="priority && !collapse && i === 0"
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            aspect-ratio="1"
            class="size-full object-cover transition-transform group-hover:scale-105"
          />
        </div>
        <p class="font-heading p-3 text-center text-base font-medium">
          {{ item.title }}
        </p>
      </component>
    </div>
  </div>

  <!-- Text + CTA: centered text block with call-to-action link -->
  <div
    v-else-if="templateId === 'text-+-cta'"
    class="mx-auto max-w-[670px] space-y-4 py-8 text-center"
  >
    <h2
      v-if="textBlock?.header"
      class="font-heading text-[32px] leading-[1.1] font-bold md:text-[40px]"
    >
      {{ textBlock.header }}
    </h2>
    <p
      v-if="textBlock?.description"
      class="text-muted-foreground text-sm leading-normal"
    >
      {{ textBlock.description }}
    </p>
    <NuxtLink
      v-if="cta && linkTo(cta.url)"
      :to="linkTo(cta.url)"
      class="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-sm font-medium"
    >
      {{ cta.label || cta.text }}
      <ArrowRight class="size-4" />
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
        v-if="banner.image?.src"
        :file-name="banner.image.src"
        :path="banner.image.srcPath"
        type="pagewidget"
        :alt="banner.image?.alt ?? ''"
        :priority="priority && i === 0"
        sizes="(min-width: 768px) 50vw, 100vw"
        aspect-ratio="16/9"
      />
      <div
        class="absolute inset-0 flex flex-col bg-gradient-to-t from-black/60 to-transparent p-6"
        :class="bannerPlacementClasses(banner.cta?.placement)"
      >
        <h3
          v-if="banner.text?.title"
          class="font-heading text-[32px] leading-[1.1] font-bold text-white md:text-[40px]"
        >
          {{ banner.text.title }}
        </h3>
        <p v-if="banner.text?.byline" class="mt-1 text-sm text-white/80">
          {{ banner.text.byline }}
        </p>
        <NuxtLink
          v-if="banner.cta && linkTo(banner.cta.url)"
          :to="linkTo(banner.cta.url)"
          class="bg-button-background text-primary-foreground mt-3 inline-block rounded-md px-4 py-2 text-sm font-medium"
        >
          {{ banner.cta.text }}
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
