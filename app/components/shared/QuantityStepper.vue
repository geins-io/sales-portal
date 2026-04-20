<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: number;
    min?: number;
    max?: number;
    disabled?: boolean;
  }>(),
  { min: 1, disabled: false },
);

const emit = defineEmits<{
  'update:modelValue': [value: number];
}>();

const { t } = useI18n();

const canDecrement = computed(
  () => !props.disabled && props.modelValue > props.min,
);
const canIncrement = computed(
  () =>
    !props.disabled &&
    (props.max === undefined || props.modelValue < props.max),
);

function decrement() {
  if (canDecrement.value) {
    emit('update:modelValue', props.modelValue - 1);
  }
}

function increment() {
  if (canIncrement.value) {
    emit('update:modelValue', props.modelValue + 1);
  }
}
</script>

<template>
  <div class="inline-flex items-center rounded-md border">
    <button
      type="button"
      data-testid="qty-decrement"
      class="flex size-8 items-center justify-center text-sm disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="!canDecrement"
      :aria-label="t('common.decrease_quantity')"
      @click="decrement"
    >
      <Icon name="lucide:minus" class="size-3.5" />
    </button>
    <span
      data-testid="qty-value"
      class="min-w-8 text-center text-sm tabular-nums select-none"
      >{{ modelValue }}</span
    >
    <button
      type="button"
      data-testid="qty-increment"
      class="flex size-8 items-center justify-center text-sm disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="!canIncrement"
      :aria-label="t('common.increase_quantity')"
      @click="increment"
    >
      <Icon name="lucide:plus" class="size-3.5" />
    </button>
  </div>
</template>
