<script setup lang="ts">
/**
 * A draft line's amount: typed or stepped. Built from the NumberField parts so
 * the field is one control the width of its column and fits four digits.
 */
import { QUOTE_LINE_MAX_QUANTITY } from '#shared/constants/quote';
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from '~/components/ui/number-field';

defineProps<{
  modelValue: number;
  /** The accessible name, e.g. "Antal, Gipsskiva 13mm". */
  label: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: number] }>();

// A cleared field has no number; the line keeps its amount until one is typed.
function onUpdate(value: number | undefined) {
  if (value !== undefined) emit('update:modelValue', value);
}
</script>

<template>
  <NumberField
    data-testid="quote-quantity"
    :model-value="modelValue"
    :min="1"
    :max="QUOTE_LINE_MAX_QUANTITY"
    :step="1"
    class="w-full"
    @update:model-value="onUpdate"
  >
    <NumberFieldContent class="bg-background flex h-8 w-full overflow-hidden">
      <NumberFieldDecrement class="w-8 flex-none" />
      <NumberFieldInput
        :aria-label="label"
        class="w-auto min-w-0 flex-1 tabular-nums"
      />
      <NumberFieldIncrement class="w-8 flex-none" />
    </NumberFieldContent>
  </NumberField>
</template>
