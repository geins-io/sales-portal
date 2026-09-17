<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next';

/**
 * A headed block of the configuration form that folds. Open to begin with.
 *
 * The body is hidden with `v-show` rather than dropped: an unsent measurement
 * draft and an open panel belong to what is inside, and folding a block is not
 * a reason to lose them.
 *
 * The `notice` slot sits outside the fold. A blocking message is what tells a
 * buyer why the configuration is not finished, so it may not be folded out of
 * sight.
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
    <component :is="heading">
      <button
        type="button"
        :data-testid="`${name}-header`"
        class="bg-muted flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left"
        :aria-expanded="open"
        @click="open = !open"
      >
        <span class="flex-1 text-base font-medium">
          {{ title }}
          <span
            v-if="!open && summary"
            :data-testid="`${name}-summary`"
            class="text-muted-foreground ml-2 text-sm font-normal"
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
      </button>
    </component>

    <slot name="notice" />

    <div v-show="open" class="space-y-2">
      <slot />
    </div>
  </div>
</template>
