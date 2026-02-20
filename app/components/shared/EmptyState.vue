<script setup lang="ts">
import type { Component } from 'vue';

defineProps<{
  title: string;
  description?: string;
  icon?: Component;
  actionLabel?: string;
  actionTo?: string;
}>();
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 text-center">
    <component
      :is="icon"
      v-if="icon"
      class="text-muted-foreground mb-4 size-12"
    />
    <h3 class="text-lg font-semibold">{{ title }}</h3>
    <p v-if="description" class="text-muted-foreground mt-1 max-w-sm text-sm">
      {{ description }}
    </p>
    <NuxtLink
      v-if="actionLabel && actionTo"
      :to="actionTo"
      class="bg-primary text-primary-foreground mt-6 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium"
    >
      {{ actionLabel }}
    </NuxtLink>
  </div>
</template>
