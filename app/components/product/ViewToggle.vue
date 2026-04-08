<script setup lang="ts">
import { LayoutGrid, List } from 'lucide-vue-next';
import { Button } from '~/components/ui/button';

defineProps<{
  modelValue: 'grid' | 'list';
}>();

const emit = defineEmits<{
  'update:modelValue': [value: 'grid' | 'list'];
}>();

const { t } = useI18n();
</script>

<template>
  <div class="flex items-center gap-1" data-testid="view-toggle">
    <Button
      :variant="modelValue === 'grid' ? 'default' : 'outline'"
      size="sm"
      :aria-label="t('product.grid_view')"
      @click="emit('update:modelValue', 'grid')"
    >
      <LayoutGrid class="size-4" />
      {{ t('product.grid') }}
    </Button>
    <Button
      :variant="modelValue === 'list' ? 'default' : 'outline'"
      size="sm"
      :aria-label="t('product.list_view')"
      @click="emit('update:modelValue', 'list')"
    >
      <List class="size-4" />
      {{ t('product.list') }}
    </Button>
  </div>
</template>
