<script setup lang="ts">
import type { UspItem } from '~/utils/usp';

defineProps<{
  item: UspItem;
  /** The icon's colour; '' when it follows the block's text colour. */
  iconClass: string;
  textClass: string;
}>();
</script>

<!-- One selling point; the parent row or slide centres it. -->
<template>
  <!-- A fixed box: an icon fetched after a client-side navigation, or a name
       the bundle lacks, moves nothing. -->
  <span
    v-if="item.icon"
    data-testid="usp-icon-box"
    class="inline-flex size-8 items-center justify-center"
    :class="iconClass"
  >
    <Icon :name="item.icon" mode="svg" class="size-8" aria-hidden="true" />
  </span>
  <!-- Heading and text sit closer to each other than to the icon. -->
  <div
    v-if="item.heading || item.description"
    data-testid="usp-text"
    class="flex flex-col items-center gap-1"
  >
    <h3
      v-if="item.heading"
      class="font-heading text-lg font-semibold md:text-xl"
    >
      {{ item.heading }}
    </h3>
    <p v-if="item.description" class="text-sm" :class="textClass">
      {{ item.description }}
    </p>
  </div>
</template>
