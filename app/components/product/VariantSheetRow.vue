<script setup lang="ts">
import { Check, ChevronRight, ImageOff } from 'lucide-vue-next';
import { THUMBNAIL_WIDTHS } from '#shared/utils/image';

/** One row of the variant sheet. A missing price leaves its column out. */
defineProps<{
  imageFileName: string | null;
  /** Asset library URL; the legacy file name is the fallback. */
  imageUrl?: string | null;
  imageAlt: string;
  /** The variant has no image, as opposed to one not loaded yet. */
  imageMissing?: boolean;
  title: string;
  subtitle: string;
  articleNumber?: string | null;
  showStock: boolean;
  inStock: boolean;
  price?: string | null;
  selected: boolean;
  disabled?: boolean;
  /** Shown in place of the stock line. */
  hint?: string | null;
  /** The row opens another sheet: a chevron instead of the thumbnail. */
  opensSheet?: boolean;
}>();
</script>

<template>
  <button
    type="button"
    :disabled="disabled"
    :class="[
      'border-border hover:border-foreground/40 flex w-full items-center gap-3 rounded-md border bg-transparent p-3 text-left transition-colors',
      selected ? 'border-foreground' : '',
      disabled ? 'pointer-events-none opacity-40' : '',
    ]"
    :aria-pressed="opensSheet ? undefined : selected"
  >
    <div
      v-if="!opensSheet"
      class="bg-muted size-12 shrink-0 overflow-hidden rounded-md"
    >
      <GeinsImage
        v-if="imageFileName"
        :file-name="imageFileName"
        :url="imageUrl"
        type="product"
        :alt="imageAlt"
        sizes="48px"
        :widths="THUMBNAIL_WIDTHS"
        aspect-ratio="1"
        class="size-full object-contain"
      />
      <!-- The no-image text product cards show does not fit 48 px. -->
      <div
        v-else-if="imageMissing"
        role="img"
        :aria-label="$t('product.no_image')"
        class="text-muted-foreground flex size-full items-center justify-center"
        data-testid="variant-row-no-image"
      >
        <ImageOff class="size-5" aria-hidden="true" />
      </div>
    </div>

    <div class="min-w-0 flex-1">
      <div class="truncate text-sm font-medium">
        {{ title }}
      </div>
      <div v-if="subtitle" class="text-muted-foreground truncate text-sm">
        {{ subtitle }}
      </div>
      <div
        v-if="articleNumber"
        class="text-muted-foreground mt-0.5 truncate text-xs"
      >
        {{ $t('product.article_number', { number: articleNumber }) }}
      </div>
      <div
        v-if="hint"
        class="text-muted-foreground mt-1 text-xs"
        data-testid="variant-row-hint"
      >
        {{ hint }}
      </div>
      <div
        v-else-if="showStock"
        class="mt-1 flex items-center gap-1 text-xs"
        :class="inStock ? 'text-success' : 'text-muted-foreground'"
      >
        <span
          class="size-1.5 rounded-full"
          :class="inStock ? 'bg-success' : 'bg-muted-foreground'"
        />
        {{ inStock ? $t('product.in_stock') : $t('product.out_of_stock') }}
      </div>
    </div>

    <span
      v-if="price"
      class="shrink-0 text-sm font-medium"
      data-testid="variant-row-price"
    >
      {{ price }}
    </span>

    <Check v-if="selected" class="size-4 shrink-0" />
    <ChevronRight
      v-if="opensSheet"
      class="text-muted-foreground size-5 shrink-0"
      aria-hidden="true"
      data-testid="variant-row-chevron"
    />
  </button>
</template>
