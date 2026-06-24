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
      <SelectTrigger
        class="w-[180px] bg-white shadow-none"
        size="sm"
        data-testid="sort-dropdown"
      >
        <SelectValue :placeholder="$t('product.sort_by')" />
      </SelectTrigger>
      <!-- body-lock false: keeps the page from shifting when the dropdown
           opens (reka otherwise locks body scroll and removes the scrollbar).
           Full width on mobile, anchored width on md+. -->
      <SelectContent
        :body-lock="false"
        class="w-screen rounded-none md:w-auto md:rounded-md"
      >
        <SelectItem
          v-for="option in options"
          :key="option.value"
          :value="option.value"
          class="py-3 md:py-1.5"
        >
          {{ option.label }}
        </SelectItem>
      </SelectContent>
    </Select>
  </ClientOnly>
</template>
