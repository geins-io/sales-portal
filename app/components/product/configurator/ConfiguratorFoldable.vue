<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next';

/**
 * A headed block of the configuration form that folds. Open to begin with.
 *
 * The body is hidden with `v-show` rather than dropped: an unsent measurement
 * draft and an open panel belong to what is inside, and folding a block is not
 * a reason to lose them.
 *
 * The `info` slot sits beside the title, in the header, so what it holds stays
 * in sight while the block is folded. It is not inside the fold button: a
 * control inside a button is one no keyboard can reach. The button covers the
 * whole bar instead, and the slot is raised above it.
 */
const {
  name,
  title,
  hint,
  summary,
  level = 4,
} = defineProps<{
  /** Prefix for the block's test ids, so each caller stays identifiable. */
  name: string;
  title: string;
  /** What the buyer has to do with the block, on the right of its name. */
  hint?: string;
  /** What the block holds, shown in parentheses while it is folded. */
  summary?: string;
  /** Heading level, one below whatever the block sits in. */
  level?: number;
}>();

const heading = computed(() => `h${Math.min(level, 6)}`);
const open = ref(true);
</script>

<template>
  <div class="space-y-2">
    <!-- A grey bar rather than a bold line with a red asterisk: the name on the
         left, what the buyer has to do with it on the right. -->
    <component
      :is="heading"
      class="bg-muted relative flex items-center gap-3 rounded-md px-3 py-2.5"
    >
      <span class="flex min-w-0 flex-1 items-center gap-1.5">
        <button
          type="button"
          :data-testid="`${name}-header`"
          class="text-left text-base font-medium after:absolute after:inset-0 after:rounded-md"
          :aria-expanded="open"
          @click="open = !open"
        >
          {{ title }}
        </button>
        <span v-if="$slots.info" class="relative z-10 inline-flex">
          <slot name="info" />
        </span>
        <span
          v-if="!open && summary"
          :data-testid="`${name}-summary`"
          class="text-muted-foreground ml-0.5 text-sm font-normal"
        >
          ({{ summary }})
        </span>
      </span>
      <span
        v-if="hint"
        :data-testid="`${name}-hint`"
        class="text-muted-foreground shrink-0 text-xs"
      >
        {{ hint }}
      </span>
      <ChevronDown
        class="text-muted-foreground size-5 shrink-0 transition-transform"
        :class="open ? '' : '-rotate-90'"
      />
    </component>

    <div v-show="open" class="space-y-2">
      <slot />
    </div>
  </div>
</template>
