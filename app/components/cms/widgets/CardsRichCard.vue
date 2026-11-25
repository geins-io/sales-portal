<script setup lang="ts">
import type { CardsPerRow, CardsRichCard } from '~/utils/cards-rich';

const props = defineProps<{
  card: CardsRichCard;
  /** The button's resolved link; '' when it has none or its url is unsafe. */
  link: string;
  perRow: CardsPerRow;
  spacing: boolean;
  sizes: string;
  priority?: boolean;
}>();

const TEXT_ALIGN = {
  left: 'items-start text-left',
  center: 'items-center text-center',
  right: 'items-end text-right',
} as const;
const VERTICAL_ALIGN = {
  top: 'justify-start',
  center: 'justify-center',
  bottom: 'justify-end',
} as const;

const hasImage = computed(() => !!props.card.image);
const hasText = computed(
  () => !!(props.card.heading || props.card.description || props.link),
);
const imageOnly = computed(() => hasImage.value && !hasText.value);
// A card with only text: a banner at 1–2 per row, a 24 px heading at 3–4.
const textBanner = computed(() => !hasImage.value && props.perRow <= 2);

const style = computed(() => ({
  ...(props.card.backgroundColor
    ? { backgroundColor: props.card.backgroundColor }
    : {}),
  ...(props.card.textColor ? { color: props.card.textColor } : {}),
}));

const headingClass = computed(() => {
  if (textBanner.value)
    return 'font-heading text-[32px] leading-[1.1] font-bold md:text-[40px]';
  if (!hasImage.value)
    return 'font-heading text-2xl leading-tight font-semibold';
  return 'font-heading text-lg font-semibold';
});
const descriptionClass = computed(() => [
  textBanner.value ? 'text-lg md:text-xl' : 'text-sm',
  // With its own text colour the description follows it, a little lighter.
  props.card.textColor ? 'opacity-80' : 'text-muted-foreground',
]);
const textClass = computed(() => [
  textBanner.value ? 'gap-3 p-8 md:p-12' : 'gap-2 p-4',
  TEXT_ALIGN[props.card.textAlign],
  VERTICAL_ALIGN[props.card.verticalAlign],
]);
const buttonClass = computed(() =>
  props.card.buttonStyle === 'link'
    ? 'inline-block text-sm font-medium underline underline-offset-4 hover:no-underline'
    : 'bg-button-background text-button-text inline-block rounded-md px-4 py-2 text-sm font-medium',
);
</script>

<template>
  <div
    data-testid="cards-rich-card"
    class="bg-card border-card-border flex h-full flex-col overflow-hidden border"
    :class="spacing ? 'rounded-md' : 'rounded-none'"
    :style="style"
  >
    <GeinsImage
      v-if="card.image"
      :file-name="card.image.src"
      :path="card.image.srcPath"
      type="pagewidget"
      :alt="card.image.alt"
      :fit="imageOnly ? 'cover' : 'natural'"
      :priority="priority"
      :sizes="sizes"
      :class="imageOnly ? 'h-full w-full' : 'w-full'"
    />
    <div
      v-if="hasText"
      data-testid="cards-rich-card-text"
      class="flex flex-1 flex-col"
      :class="textClass"
    >
      <h3 v-if="card.heading" :class="headingClass">
        {{ card.heading }}
      </h3>
      <p v-if="card.description" :class="descriptionClass">
        {{ card.description }}
      </p>
      <NuxtLink v-if="link" :to="link" :class="buttonClass">
        {{ card.button?.text }}
      </NuxtLink>
    </div>
  </div>
</template>
