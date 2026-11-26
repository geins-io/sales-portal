<script setup lang="ts">
import type { SkuType } from '@geins/types';
import type {
  ProductImageType,
  VariantDimensionRow,
  VariantNode,
} from '#shared/types/commerce';
import { variantSelectorMode } from '#shared/utils/variant-selector';
import type { VariantCombination } from '~/utils/variant-tree';
import {
  combinationRows,
  skuRows,
  type VariantRowFallback,
  type VariantRowMeta,
} from '~/utils/variant-rows';

/**
 * The PDP's variant choice in the style the store settings name: a panel or
 * a dropdown, grouped by dimension or one list. Absent settings, and variants
 * that come without a tree, keep today's panel grouped by dimension.
 */
const props = defineProps<{
  variantDimensions: VariantDimensionRow[];
  variants: VariantNode[];
  modelValue: Record<string, string>;
  combinations?: VariantCombination[];
  skus?: SkuType[];
  productImages?: ProductImageType[];
  priceIncVatFormatted?: string | null;
  priceExVatFormatted?: string | null;
  productName?: string;
  productArticleNumber?: string | null;
  variantProducts?: Record<
    string,
    (VariantRowMeta & { canonicalUrl?: string | null }) | undefined
  >;
  skuOptions?: SkuType[];
  skuId?: number | null;
  /** The page is changing to a picked variant. */
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, string>];
  'update:skuId': [value: number];
}>();

const { tenant } = useTenant();
const { showIncVat } = useVatDisplay();

const mode = computed(() =>
  variantSelectorMode(tenant.value?.layout?.variantSelector),
);

const hasTree = computed(() => (props.combinations?.length ?? 0) > 0);
/** A product that is its group's only variant offers no variant to choose. */
const hasVariantChoice = computed(() => (props.combinations?.length ?? 0) > 1);
const hasSkus = computed(() => (props.skuOptions?.length ?? 0) > 1);
const hasVariants = computed(
  () => props.variantDimensions.length > 0 || props.variants.length > 0,
);

/** Today's panel: the setting says so, or the variants have no tree to list. */
const usePanel = computed(
  () =>
    (mode.value.display === 'panel' && mode.value.grouping === 'dimension') ||
    (!hasTree.value && hasVariants.value),
);

const fallback = computed<VariantRowFallback>(() => {
  const images = props.productImages ?? [];
  const primary = images.find((i) => i.isPrimary) ?? images[0] ?? null;
  return {
    productName: props.productName ?? '',
    articleNumber: props.productArticleNumber ?? null,
    priceIncVatFormatted: props.priceIncVatFormatted ?? null,
    priceExVatFormatted: props.priceExVatFormatted ?? null,
    image: primary ? { fileName: primary.fileName, url: primary.url } : null,
  };
});

const variantRows = computed(() =>
  combinationRows(
    props.combinations ?? [],
    props.modelValue,
    props.variantProducts,
    fallback.value,
    showIncVat.value,
  ),
);

const skuChoiceRows = computed(() =>
  skuRows(
    props.skuOptions ?? [],
    props.skuId,
    fallback.value,
    showIncVat.value,
  ),
);

function selectVariant(alias: string) {
  const combo = props.combinations?.find((c) => c.alias === alias);
  if (combo) emit('update:modelValue', { ...combo.selection });
}

function selectSku(key: string) {
  emit('update:skuId', Number(key));
}

const panel = useTemplateRef<{ openSkuSheet: () => void }>('panel');
const skuControl = useTemplateRef<{ open: () => void }>('skuControl');

function openSkuSheet() {
  if (usePanel.value) panel.value?.openSkuSheet();
  else skuControl.value?.open();
}

defineExpose({ openSkuSheet });
</script>

<template>
  <VariantSelector
    v-if="usePanel"
    ref="panel"
    :model-value="modelValue"
    :sku-id="skuId"
    :sku-options="skuOptions"
    :variant-dimensions="variantDimensions"
    :variants="variants"
    :combinations="combinations"
    :skus="skus"
    :product-images="productImages"
    :product-name="productName"
    :price-inc-vat-formatted="priceIncVatFormatted"
    :price-ex-vat-formatted="priceExVatFormatted"
    :product-article-number="productArticleNumber"
    :variant-products="variantProducts"
    @update:model-value="emit('update:modelValue', $event)"
    @update:sku-id="emit('update:skuId', $event)"
  />
  <div v-else class="flex flex-col gap-4" data-testid="variant-selector">
    <template v-if="hasVariantChoice">
      <VariantDimensionSelects
        v-if="mode.display === 'dropdown' && mode.grouping === 'dimension'"
        :combinations="combinations ?? []"
        :model-value="modelValue"
        :disabled="disabled"
        @update:model-value="emit('update:modelValue', $event)"
      />
      <VariantListDropdown
        v-else-if="mode.display === 'dropdown'"
        kind="variant"
        :rows="variantRows"
        :disabled="disabled"
        @select="selectVariant"
      />
      <VariantListPanel
        v-else
        kind="variant"
        :rows="variantRows"
        :disabled="disabled"
        @select="selectVariant"
      />
    </template>
    <template v-if="hasSkus">
      <VariantListDropdown
        v-if="mode.display === 'dropdown'"
        ref="skuControl"
        kind="sku"
        :rows="skuChoiceRows"
        :disabled="disabled"
        @select="selectSku"
      />
      <VariantListPanel
        v-else
        ref="skuControl"
        kind="sku"
        :rows="skuChoiceRows"
        :disabled="disabled"
        @select="selectSku"
      />
    </template>
  </div>
</template>
