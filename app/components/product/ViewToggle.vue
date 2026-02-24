<script setup lang="ts">
import { LayoutGrid, List } from 'lucide-vue-next';
import { Button } from '~/components/ui/button';
import { cn } from '@/lib/utils';

defineProps<{
  modelValue: 'grid' | 'list';
}>();

const emit = defineEmits<{
  'update:modelValue': [value: 'grid' | 'list'];
}>();
</script>

<template>
  <div class="flex items-center gap-1">
    <Button
      variant="ghost"
      size="icon-sm"
      :class="cn(modelValue === 'grid' && 'bg-muted')"
      aria-label="Grid view"
      @click="emit('update:modelValue', 'grid')"
    >
      <LayoutGrid class="size-4" />
    </Button>
    <Button
      variant="ghost"
      size="icon-sm"
      :class="cn(modelValue === 'list' && 'bg-muted')"
      aria-label="List view"
      @click="emit('update:modelValue', 'list')"
    >
      <List class="size-4" />
    </Button>
  </div>
</template>
