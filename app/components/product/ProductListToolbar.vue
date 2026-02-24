<script setup lang="ts">
defineProps<{
  resultCount: number;
  sortValue: string;
  sortOptions: { label: string; value: string }[];
  viewMode: 'grid' | 'list';
}>();

const emit = defineEmits<{
  'update:sortValue': [value: string];
  'update:viewMode': [value: 'grid' | 'list'];
}>();
</script>

<template>
  <div class="flex items-center justify-between gap-4">
    <p class="text-muted-foreground text-sm">
      {{ resultCount }} {{ resultCount === 1 ? 'product' : 'products' }}
    </p>
    <div class="flex items-center gap-2">
      <SortDropdown
        :model-value="sortValue"
        :options="sortOptions"
        @update:model-value="emit('update:sortValue', $event)"
      />
      <ViewToggle
        :model-value="viewMode"
        @update:model-value="emit('update:viewMode', $event)"
      />
    </div>
  </div>
</template>
