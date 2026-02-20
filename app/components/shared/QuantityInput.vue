<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: number;
    min?: number;
    max?: number;
    step?: number;
  }>(),
  { min: 1, step: 1 },
);

const emit = defineEmits<{
  'update:modelValue': [value: number];
}>();

function onUpdate(value: number) {
  emit('update:modelValue', value);
}
</script>

<template>
  <NumberField
    :model-value="modelValue"
    :min="min"
    :max="max"
    :step="step"
    @update:model-value="onUpdate"
  >
    <NumberFieldContent>
      <NumberFieldDecrement />
      <NumberFieldInput />
      <NumberFieldIncrement />
    </NumberFieldContent>
  </NumberField>
</template>
