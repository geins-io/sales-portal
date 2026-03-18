<script setup lang="ts">
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';

defineProps<{
  modelValue: string;
  options: { label: string; value: string }[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <ClientOnly>
    <Select
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', String($event))"
    >
      <SelectTrigger class="w-[180px]" size="sm" data-testid="sort-dropdown">
        <SelectValue :placeholder="$t('product.sort_by')" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="option in options"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </SelectItem>
      </SelectContent>
    </Select>
  </ClientOnly>
</template>
