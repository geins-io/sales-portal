<script setup lang="ts">
/**
 * The text of an option row and the controls beside it: the stepper, then the
 * price. A row with a stepper puts the controls on a line of their own under
 * the text while its card is narrow, stepper left and price right, so the name
 * keeps a readable width. The card decides, not the viewport: a desktop page
 * with the summary beside the form leaves a card as narrow as a phone's.
 *
 * `@sm` is 24rem of the card's content box. Page cards on a phone or beside
 * the summary (about 260 px) fall below it; a row in the desktop panel (about
 * 410–440 px) stays above it, on one line.
 *
 * The card names itself `@container/option`. The default slot is the text and
 * must take `min-w-0 flex-1`.
 */
const { stacked = false } = defineProps<{
  /** The row has a stepper, so its controls may need a line of their own. */
  stacked?: boolean;
}>();
</script>

<template>
  <div
    class="min-w-0 flex-1"
    :class="
      stacked
        ? 'flex flex-col gap-2 @sm/option:flex-row @sm/option:items-center @sm/option:gap-3'
        : 'flex items-center gap-3'
    "
  >
    <slot />
    <div
      data-testid="configurator-option-controls"
      :class="
        stacked
          ? 'flex items-center justify-between gap-3 @sm/option:contents'
          : 'contents'
      "
    >
      <slot name="controls" />
    </div>
  </div>
</template>
