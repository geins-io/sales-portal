<script setup lang="ts">
import type { FunctionalComponent } from 'vue';

/** One row of a grey details card: icon, bold label, its lines under it. */
defineProps<{
  rowKey: string;
  testId: string;
  icon: FunctionalComponent;
  label: string;
  lines: string[];
  /** Where the first line links to. */
  href?: string;
}>();
</script>

<template>
  <div
    :data-testid="testId"
    :data-meta-row="rowKey"
    class="flex items-start gap-3"
  >
    <component
      :is="icon"
      class="text-muted-foreground mt-0.5 size-4 shrink-0"
    />
    <div class="space-y-1">
      <p class="text-foreground text-sm font-semibold">
        {{ label }}
      </p>
      <p
        v-for="(line, l) in lines"
        :key="line"
        class="text-muted-foreground text-sm wrap-break-word whitespace-pre-line"
      >
        <NuxtLink
          v-if="href && l === 0"
          :to="href"
          :data-testid="`${testId}-link`"
          class="text-primary hover:underline"
          >{{ line }}</NuxtLink
        >
        <template v-else>{{ line }}</template>
      </p>
    </div>
  </div>
</template>
