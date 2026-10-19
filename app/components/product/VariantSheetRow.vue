<script setup lang="ts">
import { Check } from 'lucide-vue-next';
import { THUMBNAIL_WIDTHS } from '#shared/utils/image';

/** One row of the variant sheet. A missing price leaves its column out. */
defineProps<{
  imageFileName: string | null;
  /** Asset library URL; the legacy file name is the fallback. */
  imageUrl?: string | null;
  imageAlt: string;
  title: string;
  subtitle: string;
  articleNumber?: string | null;
  showStock: boolean;
  inStock: boolean;
  price?: string | null;
  selected: boolean;
  disabled?: boolean;
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
    :aria-pressed="selected"
  >
    <!-- Thumbnail uses the product's primary image. Geins
         doesn't expose per-variant imagery; this keeps the
         visual rhythm of the list consistent with Figma. -->
    <div class="bg-muted size-12 shrink-0 overflow-hidden rounded-md">
      <GeinsImage
        v-if="imageFileName"
        :file-name="imageFileName"
        :url="imageUrl"
        type="product"
        :alt="imageAlt"
        sizes="48px"
        :widths="THUMBNAIL_WIDTHS"
        class="size-full object-contain"
      />
    </div>

    <div class="min-w-0 flex-1">
      <div class="truncate text-sm font-medium">
        {{ title }}
      </div>
      <div class="text-muted-foreground truncate text-sm">
        {{ subtitle }}
      </div>
      <div
        v-if="articleNumber"
        class="text-muted-foreground mt-0.5 truncate text-xs"
      >
        {{ $t('product.article_number', { number: articleNumber }) }}
      </div>
      <div
        v-if="showStock"
        class="mt-1 flex items-center gap-1 text-xs"
        :class="
          inStock
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-muted-foreground'
        "
      >
        <span
          class="size-1.5 rounded-full"
          :class="inStock ? 'bg-emerald-500' : 'bg-muted-foreground'"
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
  </button>
</template>
