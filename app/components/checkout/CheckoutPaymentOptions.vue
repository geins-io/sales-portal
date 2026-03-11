<script setup lang="ts">
import type { PaymentOptionType } from '#shared/types/commerce';

const { t } = useI18n();

const props = defineProps<{
  options: PaymentOptionType[];
  modelValue: number | null;
  disabled: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: number];
}>();

function selectOption(id: number) {
  emit('update:modelValue', id);
}
</script>

<template>
  <fieldset data-testid="checkout-payment-options" :disabled="props.disabled">
    <legend class="sr-only">{{ t('checkout.payment_method') }}</legend>

    <p v-if="props.options.length === 0" class="text-muted-foreground text-sm">
      {{ t('checkout.no_payment_methods') }}
    </p>

    <div v-else class="space-y-3">
      <label
        v-for="option in props.options"
        :key="option.id"
        :data-testid="`payment-option-${option.id}`"
        class="border-border hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors"
        :class="{
          'border-primary bg-primary/5': props.modelValue === option.id,
        }"
      >
        <input
          type="radio"
          name="payment-method"
          :value="option.id"
          :checked="props.modelValue === option.id"
          :disabled="props.disabled"
          class="accent-primary size-4"
          @change="selectOption(option.id)"
        />
        <div class="flex flex-1 items-center justify-between">
          <span class="text-sm font-medium">
            {{ option.displayName ?? option.name }}
          </span>
          <span
            v-if="option.feeIncVat > 0"
            class="text-muted-foreground text-xs"
          >
            +{{ option.feeIncVat }}
          </span>
        </div>
      </label>
    </div>
  </fieldset>
</template>
