<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: number;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
  }>(),
  { min: 1, step: 1, disabled: false },
);

const emit = defineEmits<{
  'update:modelValue': [value: number];
}>();

// The field re-applies its value on blur, so a press elsewhere after a step
// would send the same quantity again, racing whatever that press does.
function onUpdate(value: number) {
  if (value === props.modelValue) return;
  emit('update:modelValue', value);
}
</script>

<template>
  <NumberField
    data-testid="quantity-input"
    :model-value="modelValue"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    @update:model-value="onUpdate"
  >
    <NumberFieldContent>
      <NumberFieldDecrement />
      <NumberFieldInput />
      <NumberFieldIncrement />
    </NumberFieldContent>
  </NumberField>
</template>
