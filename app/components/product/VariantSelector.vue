<script setup lang="ts">
import type { VariantDimensionType, VariantType } from '#shared/types/commerce';

const props = defineProps<{
  variantDimensions: VariantDimensionType[];
  variants: VariantType[];
  modelValue: Record<string, string>;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, string>];
}>();

function selectValue(dimensionName: string, value: string) {
  emit('update:modelValue', {
    ...props.modelValue,
    [dimensionName]: value,
  });
}

function isValueAvailable(dimensionName: string, value: string): boolean {
  // Check if any variant with this attribute value (and current other selections) has stock
  return props.variants.some((variant) => {
    // Variant must have this dimension value
    const hasAttribute = variant.attributes.some(
      (attr) =>
        attr.attributeName === dimensionName && attr.attributeValue === value,
    );
    if (!hasAttribute) return false;

    // Variant must match all other currently selected dimensions
    for (const [dimName, dimValue] of Object.entries(props.modelValue)) {
      if (dimName === dimensionName) continue;
      const matches = variant.attributes.some(
        (attr) =>
          attr.attributeName === dimName && attr.attributeValue === dimValue,
      );
      if (!matches) return false;
    }

    return variant.stock.totalStock > 0;
  });
}

function isSelected(dimensionName: string, value: string): boolean {
  return props.modelValue[dimensionName] === value;
}
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="variant-selector">
    <div
      v-for="dimension in variantDimensions"
      :key="dimension.dimensionName"
      class="flex flex-col gap-2"
    >
      <span class="text-sm font-medium">
        {{ dimension.dimensionName }}
      </span>
      <div class="flex flex-wrap gap-2" data-testid="dimension-values">
        <button
          v-for="value in dimension.values"
          :key="value"
          type="button"
          class="rounded-md border px-3 py-1.5 text-sm transition-colors"
          :class="[
            isSelected(dimension.dimensionName, value)
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background hover:bg-muted border-input',
            !isValueAvailable(dimension.dimensionName, value)
              ? 'pointer-events-none line-through opacity-40'
              : '',
          ]"
          :disabled="!isValueAvailable(dimension.dimensionName, value)"
          :aria-pressed="isSelected(dimension.dimensionName, value)"
          @click="selectValue(dimension.dimensionName, value)"
        >
          {{ value }}
        </button>
      </div>
    </div>
  </div>
</template>
