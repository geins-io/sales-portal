<script setup lang="ts">
import { LayoutGrid, List } from 'lucide-vue-next';

defineProps<{
  modelValue: 'grid' | 'list';
}>();

const emit = defineEmits<{
  'update:modelValue': [value: 'grid' | 'list'];
}>();

const { t } = useI18n();
</script>

<template>
  <div class="flex items-center gap-1">
    <button
      type="button"
      class="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
      :class="
        modelValue === 'grid'
          ? 'bg-primary text-primary-foreground border-primary'
          : 'border-border bg-background text-muted-foreground hover:text-foreground'
      "
      :aria-label="t('product.grid_view')"
      @click="emit('update:modelValue', 'grid')"
    >
      <LayoutGrid class="size-4" />
      {{ t('product.grid') }}
    </button>
    <button
      type="button"
      class="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
      :class="
        modelValue === 'list'
          ? 'bg-primary text-primary-foreground border-primary'
          : 'border-border bg-background text-muted-foreground hover:text-foreground'
      "
      :aria-label="t('product.list_view')"
      @click="emit('update:modelValue', 'list')"
    >
      <List class="size-4" />
      {{ t('product.list') }}
    </button>
  </div>
</template>
