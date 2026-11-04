<script setup lang="ts">
import { ArrowLeft, ChevronDown, Search } from 'lucide-vue-next';
import type {
  VariantDimensionRow,
  VariantNode,
  ProductImageType,
} from '#shared/types/commerce';
import type { SkuType } from '@geins/types';
import {
  changeGroups,
  combinationExists,
  dimensionsOf,
  isInternalDimension,
  resolveCombination,
  type VariantCombination,
} from '~/utils/variant-tree';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';

const props = defineProps<{
  variantDimensions: VariantDimensionRow[];
  variants: VariantNode[];
  modelValue: Record<string, string>;
  // The variant tree flattened by the parent. When given, it is the source of
  // the dimensions, labels and per-row variant; the two props above remain the
  // fallback for payloads that arrive without a tree.
  combinations?: VariantCombination[];
  // Optional product-level data threaded through so each sheet row can
  // surface the variant's article number, stock and price + the product
  // image as a thumbnail. Sheet still renders correctly without these,
  // falling back to a name-only row.
  skus?: SkuType[];
  productImages?: ProductImageType[];
  priceIncVatFormatted?: string | null;
  priceExVatFormatted?: string | null;
  productName?: string;
  // Fallback art-nr for single-variant wrapper products where the SKU
  // doesn't carry one of its own (Geins returns a "DefaultProduct"
  // dimension with attributes: null on these).
  productArticleNumber?: string | null;
  // Sibling-variant products: each variant is a separate Geins product
  // with its own price, art-nr and images. Geins's `VariantType` payload
  // omits them, so the parent fetches each sibling by alias and passes
  // the resolved values down here. Keyed by variant alias.
  variantProducts?: Record<
    string,
    | {
        priceIncVatFormatted?: string | null;
        priceExVatFormatted?: string | null;
        articleNumber?: string | null;
        name?: string | null;
        image?: RowImage | null;
      }
    | undefined
  >;
  // The product's own SKUs when it is sold in several. The buyer picks one;
  // the pick travels as `skuId`, apart from the dimension selection, so it
  // never reads as a switch to a sibling product.
  skuOptions?: SkuType[];
  skuId?: number | null;
}>();

type RowImage = Pick<ProductImageType, 'fileName' | 'url'>;

interface GroupedDimension {
  dimensionName: string;
  values: string[];
}

const treeDimensions = computed(() =>
  props.combinations?.length ? dimensionsOf(props.combinations) : null,
);

function labelFor(dimensionName: string, value: string): string {
  const dim = treeDimensions.value?.find(
    (d) => d.dimensionName === dimensionName,
  );
  return dim?.values.find((v) => v.value === value)?.label || value;
}

const groupedDimensions = computed<GroupedDimension[]>(() => {
  if (treeDimensions.value) {
    return treeDimensions.value.map((d) => ({
      dimensionName: d.dimensionName,
      values: d.values.map((v) => v.value),
    }));
  }
  // One row per (dimension, value) pair; group them per dimension.
  const map = new Map<string, Set<string>>();
  for (const row of props.variantDimensions) {
    const name = row.dimension;
    if (!name) continue;
    if (!map.has(name)) map.set(name, new Set());
    if (row.value != null) map.get(name)!.add(row.value);
  }
  // Sibling-variant products carry the other variants in
  // variantGroup.variants. Each sibling exposes its own dimension/value
  // (or label). Merge those values into the existing dimension keys so
  // the sheet shows every available variant across the group, not just
  // the current product's own row.
  for (const v of props.variants) {
    const name = v.dimension;
    if (!name) continue;
    if (!map.has(name)) map.set(name, new Set());
    const value = v.value ?? v.label;
    if (value != null) map.get(name)!.add(value);
  }
  return Array.from(map, ([dimensionName, values]) => ({
    dimensionName,
    values: Array.from(values),
  }));
});

// A product without variants still carries one internal dimension, its own
// name the only value. That is no choice, so it gets no picker.
const visibleDimensions = computed(() =>
  groupedDimensions.value.filter(
    (d) => !isInternalDimension(d.dimensionName) || d.values.length > 1,
  ),
);

const { t, locale } = useI18n();

function dimensionHeading(dimensionName: string): string {
  return isInternalDimension(dimensionName)
    ? t('product.variant_heading')
    : dimensionName;
}

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, string>];
  'update:skuId': [value: number];
}>();

const openDimension = ref<string | null>(null);
const skuSheetOpen = ref(false);
const searchQuery = ref('');

// A value that cannot be picked without changing other choices, waiting for
// the buyer to confirm or choose one of its variants in a second sheet. The
// pick outlives the sheet's close so its rows stay while it slides out.
const pendingPick = ref<{
  dimension: string;
  value: string;
  combinations: VariantCombination[];
} | null>(null);
const stepOpen = ref(false);

function openSheet(dimensionName: string) {
  openDimension.value = dimensionName;
  skuSheetOpen.value = false;
  stepOpen.value = false;
  searchQuery.value = '';
}

function openSkuSheet() {
  openDimension.value = null;
  skuSheetOpen.value = true;
  stepOpen.value = false;
  searchQuery.value = '';
}

defineExpose({ openSkuSheet });

function closeSheet() {
  openDimension.value = null;
  skuSheetOpen.value = false;
  stepOpen.value = false;
}

function closeStep() {
  stepOpen.value = false;
}

const showSkuGroup = computed(() => (props.skuOptions?.length ?? 0) > 1);

const pickedSku = computed(
  () => props.skuOptions?.find((s) => s.skuId === props.skuId) ?? null,
);

const filteredSkus = computed(() => {
  const skus = props.skuOptions ?? [];
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return skus;
  return skus.filter((s) =>
    [s.name, s.articleNumber].some((text) => text?.toLowerCase().includes(q)),
  );
});

function selectSku(skuId: number) {
  emit('update:skuId', skuId);
  closeSheet();
}

function filteredValues(dimensionName: string, values: string[]): string[] {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return values;
  return values.filter((v) =>
    labelFor(dimensionName, v).toLowerCase().includes(q),
  );
}

function variantMatching(
  dimensionName: string,
  value: string,
): VariantNode | undefined {
  return props.variants.find(
    (variant) =>
      !!variant.dimension &&
      variant.value != null &&
      variant.dimension === dimensionName &&
      variant.value === value,
  );
}

// Resolve the first variant matching (dimension, value) and its sku so
// each sheet row can show real article number / stock pulled from the
// SDK. Returns null on multi-dim products where the value alone doesn't
// pin a single sku — caller falls back to name-only display.
function variantInfoFor(
  dimensionName: string,
  value: string,
): {
  articleNumber?: string;
  stockTotal: number;
  priceIncVatFormatted?: string | null;
  priceExVatFormatted?: string | null;
  name?: string | null;
} | null {
  if (props.combinations?.length) {
    const combo = resolveCombination(
      props.combinations,
      props.modelValue,
      dimensionName,
      value,
    );
    if (!combo) return null;
    const meta = props.variantProducts?.[combo.alias];
    return {
      articleNumber:
        meta?.articleNumber || props.productArticleNumber || undefined,
      stockTotal: combo.stock?.totalStock ?? 0,
      priceIncVatFormatted: meta?.priceIncVatFormatted ?? null,
      priceExVatFormatted: meta?.priceExVatFormatted ?? null,
      name: meta?.name ?? props.productName ?? undefined,
    };
  }
  const matchingVariant = variantMatching(dimensionName, value);
  // Sibling-variant products: prefer the per-alias map populated by the
  // parent, then the parent product's own art-nr. Nothing maps a matched
  // variant to a SKU, so only an unmatched value falls back to the first one.
  const siblingAlias = matchingVariant?.alias;
  const sibling = siblingAlias
    ? props.variantProducts?.[siblingAlias]
    : undefined;
  const sku = matchingVariant ? undefined : props.skus?.[0];
  const articleNumber =
    sibling?.articleNumber ||
    sku?.articleNumber ||
    props.productArticleNumber ||
    undefined;
  const stockTotal =
    matchingVariant?.stock?.totalStock ?? sku?.stock?.totalStock ?? 0;
  const priceIncVatFormatted = sibling?.priceIncVatFormatted ?? null;
  const priceExVatFormatted = sibling?.priceExVatFormatted ?? null;
  // Sibling-variant products each carry their own product name; fall
  // back to the parent product name for internal multi-SKU products
  // where every row shares one name.
  const name = sibling?.name ?? props.productName ?? undefined;
  if (!articleNumber && !matchingVariant) return null;
  return {
    articleNumber,
    stockTotal,
    priceIncVatFormatted,
    priceExVatFormatted,
    name,
  };
}

// First row of each sheet item: the product name. Sibling variants are
// distinct products, so prefer the per-variant name; fall back to the
// parent product name, then to the variant value if neither is set.
function rowProductName(dimensionName: string, value: string): string {
  return (
    variantInfoFor(dimensionName, value)?.name || props.productName || value
  );
}

const primaryImage = computed(() => {
  const images = props.productImages ?? [];
  return images.find((i) => i.isPrimary) ?? images[0] ?? null;
});

/**
 * The row's own variant image: undefined while it is not known yet, null when
 * the variant has none. A row that leads to no variant is the product itself.
 */
function rowImage(
  dimensionName: string,
  value: string,
): RowImage | null | undefined {
  const alias = props.combinations?.length
    ? resolveCombination(
        props.combinations,
        props.modelValue,
        dimensionName,
        value,
      )?.alias
    : variantMatching(dimensionName, value)?.alias;
  if (!alias) return primaryImage.value;
  return props.variantProducts?.[alias]?.image;
}

function comboImage(combo: VariantCombination): RowImage | null | undefined {
  return props.variantProducts?.[combo.alias]?.image;
}

const { showIncVat } = useVatDisplay();

/**
 * Row price in the buyer's chosen VAT mode. Falls back source by source, not
 * field by field: a sibling that carries no price hands the row over to the
 * parent's price rather than to its own other VAT variant.
 */
function rowPriceFormatted(
  dimensionName: string,
  value: string,
): string | null {
  const info = variantInfoFor(dimensionName, value);
  const sibling = showIncVat.value
    ? info?.priceIncVatFormatted
    : info?.priceExVatFormatted;
  if (sibling) return sibling;
  const parent = showIncVat.value
    ? props.priceIncVatFormatted
    : props.priceExVatFormatted;
  return parent || null;
}

const { buildProductImageAlt } = useProductImageAlt();

function thumbnailAlt(dimensionName: string, value: string): string {
  return buildProductImageAlt({
    name: rowProductName(dimensionName, value),
    manualAlt: primaryImage.value?.altText,
  });
}

/** Whether picking the value keeps every other current choice. */
function isDirectValue(dimensionName: string, value: string): boolean {
  if (!props.combinations?.length) return true;
  return combinationExists(
    props.combinations,
    props.modelValue,
    dimensionName,
    value,
  );
}

function isNamedDimension(name: string): boolean {
  return !!name.trim() && !isInternalDimension(name);
}

function selectValue(dimensionName: string, value: string) {
  emit('update:modelValue', {
    ...props.modelValue,
    [dimensionName]: value,
  });
  closeSheet();
}

function openPick(
  dimension: string,
  value: string,
  combinations: VariantCombination[],
) {
  pendingPick.value = {
    dimension,
    value,
    combinations: combinations.filter((c) => c.selection[dimension] === value),
  };
  stepOpen.value = true;
}

function selectCombination(combo: VariantCombination) {
  emit('update:modelValue', { ...combo.selection });
  closeSheet();
}

function comboName(combo: VariantCombination): string {
  return props.variantProducts?.[combo.alias]?.name || props.productName || '';
}

/**
 * What picking the value in a change group changes: "Poler: 4P · Kapsling:
 * IP66", the target values dotted; a nameless dimension leaves its values.
 */
function changeHint(
  dimensionName: string,
  value: string,
  group: { dimensions: string[]; combinations: VariantCombination[] },
): string {
  const targets = group.combinations.filter(
    (c) => c.selection[dimensionName] === value,
  );
  return group.dimensions
    .map((dim) => {
      const values = Array.from(
        new Set(targets.map((c) => c.labels[dim] ?? c.selection[dim]!)),
      ).join(' · ');
      return isNamedDimension(dim) ? `${dim}: ${values}` : values;
    })
    .join(' · ');
}

/** The other dimensions on which the variant differs from the current choice. */
function changedDimensions(
  combo: VariantCombination,
  dimensionName: string,
): string[] {
  return visibleDimensions.value
    .map((d) => d.dimensionName)
    .filter(
      (dim) =>
        dim !== dimensionName &&
        props.modelValue[dim] !== undefined &&
        combo.selection[dim] !== props.modelValue[dim],
    );
}

/** The sheet's own value, then the values that change: "40 A · 4P · IP66". */
function changeSubtitle(
  combo: VariantCombination,
  dimensionName: string,
  changed: string[],
): string {
  return [dimensionName, ...changed]
    .map((dim) => combo.labels[dim] ?? combo.selection[dim])
    .join(' · ');
}

function comboPrice(combo: VariantCombination): string | null {
  const meta = props.variantProducts?.[combo.alias];
  const own = showIncVat.value
    ? meta?.priceIncVatFormatted
    : meta?.priceExVatFormatted;
  const parent = showIncVat.value
    ? props.priceIncVatFormatted
    : props.priceExVatFormatted;
  return own || parent || null;
}

// Whether a (dimension, value) pair maps to a real variant given the other
// dimensions already chosen. Stock is deliberately NOT part of this: an
// out-of-stock variant is still a real, viewable product, so it stays
// selectable (you can open its page; add-to-cart enforces stock downstream).
// Disabling is reserved for combinations that do not exist — e.g. picking
// Color=Red then a Size that only ships in Blue. Sibling-variant and
// single-dimension products carry no attributes, so every listed value is a
// real sibling and always selectable.
function isValueSelectable(dimensionName: string, value: string): boolean {
  if (props.combinations?.length) return true;
  return props.variants.some((variant) => {
    const attrs = Array.isArray(variant.attributes) ? variant.attributes : [];
    if (attrs.length === 0) return true;

    const hasAttribute = attrs.some(
      (attr) => attr.key === dimensionName && attr.value === value,
    );
    if (!hasAttribute) return false;

    for (const [dimName, dimValue] of Object.entries(props.modelValue)) {
      if (dimName === dimensionName) continue;
      const matches = attrs.some(
        (attr) => attr.key === dimName && attr.value === dimValue,
      );
      if (!matches) return false;
    }

    return true;
  });
}

// Stock status drives only the in-stock indicator, never selectability.
// Resolved per value so each row reflects its own variant's stock.
function isValueInStock(dimensionName: string, value: string): boolean {
  return (variantInfoFor(dimensionName, value)?.stockTotal ?? 0) > 0;
}

const activeDimension = computed(
  () =>
    groupedDimensions.value.find(
      (d) => d.dimensionName === openDimension.value,
    ) ?? null,
);

interface GroupHeading {
  key: string;
  params?: Record<string, string>;
}

/**
 * "Passar med Effekt: 0,66 kW" names the one other dimension and its value; a
 * nameless one leaves the value. Several others are listed, "Passar med Poler:
 * 3P och Kapsling: IP65", unless one has no name. While any other dimension
 * has no value, the heading stays neutral.
 */
function matchingHeading(dimensionName: string): GroupHeading {
  const neutral = { key: 'product.variant_group_matching' };
  const others = visibleDimensions.value.filter(
    (d) => d.dimensionName !== dimensionName,
  );
  if (others.length > 1) {
    const choices = others.map(({ dimensionName: dim }) => {
      const current = props.modelValue[dim];
      return current && isNamedDimension(dim)
        ? `${dim}: ${labelFor(dim, current)}`
        : null;
    });
    if (choices.includes(null)) return neutral;
    const value = new Intl.ListFormat(locale.value, {
      type: 'conjunction',
    }).format(choices as string[]);
    return { key: 'product.variant_group_matching_with', params: { value } };
  }
  if (others.length !== 1) return neutral;
  const other = others[0]!.dimensionName;
  const current = props.modelValue[other];
  if (!current) return neutral;
  const value = labelFor(other, current);
  return isNamedDimension(other)
    ? {
        key: 'product.variant_group_matching_named',
        params: { dimension: other, value },
      }
    : { key: 'product.variant_group_matching_with', params: { value } };
}

/** "Fler alternativ (med annan Poler och Kapslingsklass)". */
function changeHeading(dimensions: string[]): GroupHeading {
  if (!dimensions.every(isNamedDimension)) {
    return { key: 'product.variant_group_more' };
  }
  return {
    key: 'product.variant_group_other_named',
    params: {
      dimension: new Intl.ListFormat(locale.value, {
        type: 'conjunction',
      }).format(dimensions),
    },
  };
}

// The values that keep the other choices, then one group per set of other
// dimensions a variant changes. Headings only where another dimension exists.
const valueGroups = computed(() => {
  const dim = activeDimension.value;
  if (!dim) return { matching: null, changes: [] };
  const withHeadings =
    !!props.combinations?.length && visibleDimensions.value.length > 1;
  const query = searchQuery.value.trim().toLowerCase();
  const values = filteredValues(dim.dimensionName, dim.values).filter((v) =>
    isDirectValue(dim.dimensionName, v),
  );
  const changes = withHeadings
    ? changeGroups(props.combinations!, props.modelValue, dim.dimensionName)
        .map((group) => ({
          key: group.dimensions.join('-'),
          dimensions: group.dimensions,
          heading: changeHeading(group.dimensions),
          combinations: group.combinations,
          values: Array.from(
            new Set(
              group.combinations.map((c) => c.selection[dim.dimensionName]!),
            ),
          ).filter(
            (value) =>
              !query ||
              labelFor(dim.dimensionName, value).toLowerCase().includes(query),
          ),
        }))
        .filter((group) => group.values.length)
    : [];
  return {
    matching: values.length
      ? {
          heading: withHeadings ? matchingHeading(dim.dimensionName) : null,
          values,
        }
      : null,
    changes,
  };
});

const pickValueLabel = computed(() =>
  pendingPick.value
    ? labelFor(pendingPick.value.dimension, pendingPick.value.value)
    : '',
);

const sheetHeading = computed(() => {
  if (skuSheetOpen.value) return t('product.variant_heading');
  return activeDimension.value
    ? dimensionHeading(activeDimension.value.dimensionName)
    : null;
});

// Every SKU of a product shares its price.
const productPriceFormatted = computed(
  () =>
    (showIncVat.value
      ? props.priceIncVatFormatted
      : props.priceExVatFormatted) || null,
);

const { showStock } = useStockVisibility();
const { showPrice } = usePriceVisibility();
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="variant-selector">
    <div
      v-for="dimension in visibleDimensions"
      :key="dimension.dimensionName"
      class="flex flex-col gap-1.5"
    >
      <span class="font-medium">
        {{ dimensionHeading(dimension.dimensionName) }}
      </span>
      <Button
        type="button"
        variant="outline"
        class="border-input flex h-[50px] w-4/5 items-center justify-between rounded-md px-3 font-normal"
        :data-testid="`variant-trigger-${dimension.dimensionName}`"
        @click="openSheet(dimension.dimensionName)"
      >
        <span class="truncate">
          {{
            modelValue[dimension.dimensionName]
              ? labelFor(
                  dimension.dimensionName,
                  modelValue[dimension.dimensionName]!,
                )
              : $t('product.select_variant_placeholder')
          }}
        </span>
        <ChevronDown class="size-4 shrink-0 opacity-50" />
      </Button>
    </div>

    <div v-if="showSkuGroup" class="flex flex-col gap-1.5">
      <span class="font-medium">
        {{ $t('product.variant_heading') }}
      </span>
      <Button
        type="button"
        variant="outline"
        class="border-input flex h-[50px] w-4/5 items-center justify-between rounded-md px-3 font-normal"
        data-testid="variant-trigger-sku"
        @click="openSkuSheet"
      >
        <span class="truncate">
          {{
            pickedSku
              ? pickedSku.name || pickedSku.articleNumber
              : $t('product.select_variant_placeholder')
          }}
        </span>
        <ChevronDown class="size-4 shrink-0 opacity-50" />
      </Button>
    </div>

    <Sheet
      :open="openDimension !== null || skuSheetOpen"
      @update:open="(v) => !v && closeSheet()"
    >
      <!-- Same reasoning as the product filter sheet: don't auto-focus the
           variant-search input on open, or the mobile keyboard pops up and
           hides the variant options the user opened the sheet to choose. -->
      <SheetContent
        side="right"
        class="flex h-screen w-full flex-col p-0 sm:max-w-[670px]"
        data-testid="variant-sheet"
        @open-auto-focus.prevent
      >
        <SheetHeader class="border-b px-6 py-4">
          <SheetTitle class="text-lg">
            {{
              sheetHeading
                ? `${$t('product.select_variant')} — ${sheetHeading}`
                : $t('product.select_variant')
            }}
          </SheetTitle>
        </SheetHeader>

        <div v-if="activeDimension || skuSheetOpen" class="border-b px-6 py-3">
          <div class="relative">
            <Search
              class="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <Input
              v-model="searchQuery"
              type="search"
              :placeholder="$t('product.variant_search_placeholder')"
              class="pl-9"
              data-testid="variant-sheet-search"
            />
          </div>
        </div>

        <div
          v-if="skuSheetOpen"
          class="flex-1 overflow-y-auto px-6 py-4"
          data-testid="variant-sheet-options"
        >
          <ul class="flex flex-col gap-2">
            <li v-for="sku in filteredSkus" :key="sku.skuId">
              <VariantSheetRow
                data-testid="variant-option"
                :data-value="sku.skuId"
                :image-file-name="primaryImage?.fileName ?? null"
                :image-url="primaryImage?.url ?? null"
                :image-alt="
                  buildProductImageAlt({
                    name: productName || sku.name || '',
                    manualAlt: primaryImage?.altText,
                  })
                "
                :title="productName || sku.name || ''"
                :subtitle="sku.name ?? ''"
                :article-number="sku.articleNumber"
                :show-stock="showStock"
                :in-stock="(sku.stock?.totalStock ?? 0) > 0"
                :price="showPrice ? productPriceFormatted : null"
                :selected="sku.skuId === skuId"
                @click="selectSku(sku.skuId)"
              />
            </li>
          </ul>
        </div>

        <div
          v-else-if="activeDimension"
          class="flex-1 overflow-y-auto px-6 py-4"
          data-testid="variant-sheet-options"
        >
          <section
            v-if="valueGroups.matching"
            class="mb-4 last:mb-0"
            data-testid="variant-group-matching"
          >
            <h3
              v-if="valueGroups.matching.heading"
              class="text-muted-foreground mb-2 text-sm font-medium"
            >
              {{
                $t(
                  valueGroups.matching.heading.key,
                  valueGroups.matching.heading.params ?? {},
                )
              }}
            </h3>
            <ul class="flex flex-col gap-2">
              <li v-for="value in valueGroups.matching.values" :key="value">
                <VariantSheetRow
                  data-testid="variant-option"
                  :data-value="value"
                  :image-file-name="
                    rowImage(activeDimension.dimensionName, value)?.fileName ??
                    null
                  "
                  :image-url="
                    rowImage(activeDimension.dimensionName, value)?.url
                  "
                  :image-missing="
                    rowImage(activeDimension.dimensionName, value) === null
                  "
                  :image-alt="
                    thumbnailAlt(activeDimension.dimensionName, value)
                  "
                  :title="rowProductName(activeDimension.dimensionName, value)"
                  :subtitle="labelFor(activeDimension.dimensionName, value)"
                  :article-number="
                    variantInfoFor(activeDimension.dimensionName, value)
                      ?.articleNumber
                  "
                  :show-stock="showStock"
                  :in-stock="
                    isValueInStock(activeDimension.dimensionName, value)
                  "
                  :price="
                    showPrice
                      ? rowPriceFormatted(activeDimension.dimensionName, value)
                      : null
                  "
                  :selected="
                    modelValue[activeDimension.dimensionName] === value
                  "
                  :disabled="
                    !isValueSelectable(activeDimension.dimensionName, value)
                  "
                  @click="selectValue(activeDimension.dimensionName, value)"
                />
              </li>
            </ul>
          </section>
          <section
            v-for="group in valueGroups.changes"
            :key="group.key"
            class="mb-4 last:mb-0"
            :data-testid="`variant-group-change-${group.key}`"
          >
            <h3 class="text-muted-foreground mb-2 text-sm font-medium">
              {{ $t(group.heading.key, group.heading.params ?? {}) }}
            </h3>
            <ul class="flex flex-col gap-2">
              <li v-for="value in group.values" :key="value">
                <VariantSheetRow
                  data-testid="variant-change-option"
                  :data-value="value"
                  :image-file-name="null"
                  image-alt=""
                  opens-sheet
                  :title="labelFor(activeDimension.dimensionName, value)"
                  subtitle=""
                  :show-stock="false"
                  :in-stock="false"
                  :selected="false"
                  :hint="
                    changeHint(activeDimension.dimensionName, value, group)
                  "
                  @click="
                    openPick(
                      activeDimension.dimensionName,
                      value,
                      group.combinations,
                    )
                  "
                />
              </li>
            </ul>
          </section>
        </div>

        <!-- The step lies on top of the list as a narrower sheet, so a strip
             of the list stays in view; on a phone the strip is 1.5rem. -->
        <Sheet :open="stepOpen" @update:open="(v) => !v && closeStep()">
          <SheetContent
            side="right"
            class="flex h-screen w-[calc(100%-1.5rem)] flex-col p-0 sm:max-w-[600px]"
            data-testid="variant-pick-sheet"
          >
            <SheetHeader class="border-b px-6 py-4">
              <SheetTitle class="text-lg">{{
                $t('product.variant_pick_heading', { value: pickValueLabel })
              }}</SheetTitle>
            </SheetHeader>
            <div
              class="flex-1 overflow-y-auto px-6 py-4"
              data-testid="variant-pick"
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="mb-3 -ml-2"
                data-testid="variant-pick-back"
                @click="closeStep"
              >
                <ArrowLeft class="size-4" />
                {{ $t('product.variant_pick_back') }}
              </Button>
              <ul v-if="pendingPick" class="flex flex-col gap-2">
                <li
                  v-for="combo in pendingPick.combinations"
                  :key="combo.alias"
                >
                  <VariantSheetRow
                    data-testid="variant-pick-option"
                    :data-value="combo.alias"
                    :image-file-name="comboImage(combo)?.fileName ?? null"
                    :image-url="comboImage(combo)?.url"
                    :image-missing="comboImage(combo) === null"
                    :image-alt="
                      buildProductImageAlt({
                        name: comboName(combo),
                        manualAlt: primaryImage?.altText,
                      })
                    "
                    :title="comboName(combo)"
                    :subtitle="
                      changeSubtitle(
                        combo,
                        pendingPick.dimension,
                        changedDimensions(combo, pendingPick.dimension),
                      )
                    "
                    :article-number="
                      variantProducts?.[combo.alias]?.articleNumber ||
                      productArticleNumber
                    "
                    :show-stock="showStock"
                    :in-stock="(combo.stock?.totalStock ?? 0) > 0"
                    :price="showPrice ? comboPrice(combo) : null"
                    :selected="false"
                    @click="selectCombination(combo)"
                  />
                </li>
              </ul>
            </div>
          </SheetContent>
        </Sheet>
      </SheetContent>
    </Sheet>
  </div>
</template>
