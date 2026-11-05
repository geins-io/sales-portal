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
// would send the same quantity again, racing whatever that press does. A
// cleared field has no quantity to send.
function onUpdate(value: number | undefined) {
  if (value === undefined || value === props.modelValue) return;
  emit('update:modelValue', value);
}

// The number field leaves a cleared input empty, so on blur it is mounted
// again, showing the quantity the parent still holds.
const inputKey = ref(0);
function onBlur(event: FocusEvent) {
  if ((event.target as HTMLInputElement).value === '') inputKey.value++;
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
      <NumberFieldInput :key="inputKey" @blur="onBlur" />
      <NumberFieldIncrement />
    </NumberFieldContent>
  </NumberField>
</template>
