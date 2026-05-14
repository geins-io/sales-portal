<script setup lang="ts">
import type { Component } from 'vue';
import { CardHeader, CardTitle } from '~/components/ui/card';

defineProps<{
  icon: Component;
  title: string;
}>();
</script>

<template>
  <CardHeader class="border-border border-b px-6 pb-4">
    <div class="flex items-center gap-2">
      <component
        :is="icon"
        class="text-muted-foreground size-5 shrink-0"
        aria-hidden="true"
      />
      <CardTitle class="text-lg">{{ title }}</CardTitle>
      <div v-if="$slots.action" class="ms-auto">
        <slot name="action" />
      </div>
    </div>
  </CardHeader>
</template>
