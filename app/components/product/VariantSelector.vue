<script setup lang="ts">
import type { VariantDimensionType, VariantType } from '#shared/types/commerce';
import { Button } from '~/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';

const props = defineProps<{
  variantDimensions: VariantDimensionType[];
  variants: VariantType[];
  modelValue: Record<string, string>;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, string>];
}>();

const openDimension = ref<string | null>(null);

function openSheet(dimensionName: string) {
  openDimension.value = dimensionName;
}

function closeSheet() {
  openDimension.value = null;
}

function selectValue(dimensionName: string, value: string) {
  emit('update:modelValue', {
    ...props.modelValue,
    [dimensionName]: value,
  });
  closeSheet();
}

function isValueAvailable(dimensionName: string, value: string): boolean {
  return props.variants.some((variant) => {
    const hasAttribute = variant.attributes.some(
      (attr) =>
        attr.attributeName === dimensionName && attr.attributeValue === value,
    );
    if (!hasAttribute) return false;

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

const activeDimension = computed(
  () =>
    props.variantDimensions.find(
      (d) => d.dimensionName === openDimension.value,
    ) ?? null,
);
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="variant-selector">
    <div
      v-for="dimension in variantDimensions"
      :key="dimension.dimensionName"
      class="flex flex-col gap-1.5"
    >
      <span class="text-sm font-medium">
        {{ dimension.dimensionName }}
      </span>
      <Button
        type="button"
        variant="outline"
        class="border-input flex h-10 w-full items-center justify-between rounded-md px-3 font-normal"
        :data-testid="`variant-trigger-${dimension.dimensionName}`"
        @click="openSheet(dimension.dimensionName)"
      >
        <span class="truncate">
          {{
            modelValue[dimension.dimensionName] ||
            $t('product.select_variant_placeholder')
          }}
        </span>
        <Icon name="lucide:chevron-down" class="size-4 shrink-0 opacity-50" />
      </Button>
    </div>

    <Sheet
      :open="openDimension !== null"
      @update:open="(v) => !v && closeSheet()"
    >
      <SheetContent
        side="right"
        class="flex h-screen w-full flex-col p-0 sm:max-w-md"
        data-testid="variant-sheet"
      >
        <SheetHeader class="border-b px-6 py-4">
          <SheetTitle>
            {{
              activeDimension
                ? `${$t('product.select_variant')} — ${activeDimension.dimensionName}`
                : $t('product.select_variant')
            }}
          </SheetTitle>
        </SheetHeader>

        <div
          v-if="activeDimension"
          class="flex-1 overflow-y-auto px-6 py-4"
          data-testid="variant-sheet-options"
        >
          <ul class="flex flex-col gap-2">
            <li v-for="value in activeDimension.values" :key="value">
              <Button
                type="button"
                variant="outline"
                :disabled="
                  !isValueAvailable(activeDimension.dimensionName, value)
                "
                :class="[
                  'h-12 w-full justify-between text-left',
                  !isValueAvailable(activeDimension.dimensionName, value)
                    ? 'pointer-events-none line-through opacity-40'
                    : '',
                ]"
                :aria-pressed="
                  modelValue[activeDimension.dimensionName] === value
                "
                @click="selectValue(activeDimension.dimensionName, value)"
              >
                <span>{{ value }}</span>
                <Icon
                  v-if="modelValue[activeDimension.dimensionName] === value"
                  name="lucide:check"
                  class="size-4"
                />
              </Button>
            </li>
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
