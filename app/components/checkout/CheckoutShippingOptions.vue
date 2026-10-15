<script setup lang="ts">
import type { ShippingOptionType } from '#shared/types/commerce';

const { t } = useI18n();
const { showIncVat } = useVatDisplay();
const { showPrice } = usePriceVisibility();

const props = defineProps<{
  options: ShippingOptionType[];
  modelValue: number | null;
  disabled: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: number];
}>();

function selectOption(id: number) {
  emit('update:modelValue', id);
}

function fee(option: ShippingOptionType): number {
  return showIncVat.value ? option.feeIncVat : option.feeExVat;
}

function feeFormatted(option: ShippingOptionType): string {
  return (
    (showIncVat.value ? option.feeIncVatFormatted : option.feeExVatFormatted) ??
    ''
  );
}
</script>

<template>
  <fieldset data-testid="checkout-shipping-options" :disabled="props.disabled">
    <legend class="sr-only">{{ t('checkout.shipping_method') }}</legend>

    <p v-if="props.options.length === 0" class="text-muted-foreground text-sm">
      {{ t('checkout.no_shipping_methods') }}
    </p>

    <div v-else class="space-y-3">
      <label
        v-for="option in props.options"
        :key="option.id"
        :data-testid="`shipping-option-${option.id}`"
        class="border-border hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors"
        :class="{
          'border-primary bg-primary/5': props.modelValue === option.id,
        }"
      >
        <input
          type="radio"
          name="shipping-method"
          :value="option.id"
          :checked="props.modelValue === option.id"
          :disabled="props.disabled"
          class="accent-primary focus-visible:ring-ring size-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          @change="selectOption(option.id)"
        />
        <div class="flex-1">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">
              {{ option.displayName ?? option.name }}
            </span>
            <span v-if="showPrice" class="text-sm">
              <template v-if="fee(option) === 0">
                {{ t('checkout.free_shipping') }}
              </template>
              <template v-else>
                {{ feeFormatted(option) }}
              </template>
            </span>
          </div>
          <p
            v-if="
              showPrice &&
              option.amountLeftToFreeShipping > 0 &&
              option.amountLeftToFreeShippingFormatted
            "
            class="text-muted-foreground mt-1 text-xs"
          >
            {{
              t('checkout.amount_left_free_shipping', {
                amount: option.amountLeftToFreeShippingFormatted,
              })
            }}
          </p>
        </div>
      </label>
    </div>
  </fieldset>
</template>
