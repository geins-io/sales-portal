<script setup lang="ts">
import { Check, ChevronDown, Search } from 'lucide-vue-next';
import type {
  VariantDimensionType,
  VariantType,
  ProductImageType,
} from '#shared/types/commerce';
import type { SkuType } from '@geins/types';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';

// The Geins GraphQL `variantDimensions` field returns one row per
// (dimension, value) pair, not the SDK type's nominal `{dimensionName, values}`
// shape. Group them into a dimension → values map for rendering.
type RawDimensionRow = {
  dimension?: string;
  dimensionName?: string;
  value?: string;
  values?: string[];
  label?: string;
};

const props = defineProps<{
  variantDimensions: VariantDimensionType[];
  variants: VariantType[];
  modelValue: Record<string, string>;
  // Optional product-level data threaded through so each sheet row can
  // surface the variant's article number, stock and price + the product
  // image as a thumbnail. Sheet still renders correctly without these,
  // falling back to a name-only row.
  skus?: SkuType[];
  productImages?: ProductImageType[];
  priceFormatted?: string | null;
  productName?: string;
  // Fallback art-nr for single-variant wrapper products where the SKU
  // doesn't carry one of its own (Geins returns a "DefaultProduct"
  // dimension with attributes: null on these).
  productArticleNumber?: string | null;
  // Sibling-variant products: each variant is a separate Geins product
  // with its own price and art-nr. Geins's `VariantType` payload omits
  // both fields, so the parent fetches each sibling by alias and passes
  // the resolved values down here. Keyed by variant alias.
  variantProducts?: Record<
    string,
    | {
        priceFormatted?: string | null;
        articleNumber?: string | null;
        name?: string | null;
      }
    | undefined
  >;
}>();

interface GroupedDimension {
  dimensionName: string;
  values: string[];
}

const groupedDimensions = computed<GroupedDimension[]>(() => {
  const rows = props.variantDimensions as unknown as RawDimensionRow[];
  const map = new Map<string, Set<string>>();
  for (const row of rows ?? []) {
    // Tolerate both the legacy `{dimensionName, values}` shape and the
    // GraphQL `{dimension, value}` shape so unit tests + real data both work.
    const name = row.dimensionName ?? row.dimension;
    if (!name) continue;
    if (!map.has(name)) map.set(name, new Set());
    if (Array.isArray(row.values)) {
      for (const v of row.values) map.get(name)!.add(v);
    } else if (row.value != null) {
      map.get(name)!.add(row.value);
    }
  }
  // Sibling-variant products carry the other variants in
  // variantGroup.variants. Each sibling exposes its own dimension/value
  // (or label). Merge those values into the existing dimension keys so
  // the sheet shows every available variant across the group, not just
  // the current product's own row.
  const siblings = props.variants as unknown as RawDimensionRow[];
  for (const v of siblings ?? []) {
    const name = v.dimension ?? v.dimensionName;
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

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, string>];
}>();

const openDimension = ref<string | null>(null);
const searchQuery = ref('');

function openSheet(dimensionName: string) {
  openDimension.value = dimensionName;
  searchQuery.value = '';
}

function closeSheet() {
  openDimension.value = null;
}

function filteredValues(values: string[]): string[] {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return values;
  return values.filter((v) => v.toLowerCase().includes(q));
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
  priceFormatted?: string | null;
  name?: string | null;
} | null {
  const matchingVariant = props.variants.find((variant) => {
    const dim = (variant as { dimension?: string }).dimension;
    const val = (variant as { value?: string | null }).value;
    if (dim && val != null && dim === dimensionName && val === value) {
      return true;
    }
    const attrs = Array.isArray(variant.attributes) ? variant.attributes : [];
    return attrs.some(
      (attr) =>
        attr.attributeName === dimensionName && attr.attributeValue === value,
    );
  });
  // Sibling-variant products: prefer the per-alias map populated by the
  // parent. Falls back to the SKU-by-id lookup for multi-SKU "wrapper"
  // products where each variant lives in props.skus, and finally to the
  // parent product's own art-nr for the single-variant default case.
  const siblingAlias = (matchingVariant as { alias?: string } | undefined)
    ?.alias;
  const sibling = siblingAlias
    ? props.variantProducts?.[siblingAlias]
    : undefined;
  const sku = matchingVariant
    ? props.skus?.find((s) => s.skuId === matchingVariant.variantId)
    : props.skus?.[0];
  const articleNumber =
    sibling?.articleNumber ||
    sku?.articleNumber ||
    props.productArticleNumber ||
    undefined;
  const stockTotal =
    matchingVariant?.stock?.totalStock ?? sku?.stock?.totalStock ?? 0;
  const priceFormatted = sibling?.priceFormatted ?? null;
  // Sibling-variant products each carry their own product name; fall
  // back to the parent product name for internal multi-SKU products
  // where every row shares one name.
  const name = sibling?.name ?? props.productName ?? undefined;
  if (!articleNumber && !matchingVariant) return null;
  return { articleNumber, stockTotal, priceFormatted, name };
}

// First row of each sheet item: the product name. Sibling variants are
// distinct products, so prefer the per-variant name; fall back to the
// parent product name, then to the variant value if neither is set.
function rowProductName(dimensionName: string, value: string): string {
  return (
    variantInfoFor(dimensionName, value)?.name || props.productName || value
  );
}

const primaryImageFileName = computed<string | null>(() => {
  const images = props.productImages ?? [];
  return (
    images.find((i) => i.isPrimary)?.fileName ?? images[0]?.fileName ?? null
  );
});

const primaryImage = computed(() => {
  const images = props.productImages ?? [];
  return images.find((i) => i.isPrimary) ?? images[0] ?? null;
});

const { buildProductImageAlt } = useProductImageAlt();

function thumbnailAlt(dimensionName: string, value: string): string {
  return buildProductImageAlt({
    name: rowProductName(dimensionName, value),
    manualAlt: primaryImage.value?.altText,
  });
}

function selectValue(dimensionName: string, value: string) {
  emit('update:modelValue', {
    ...props.modelValue,
    [dimensionName]: value,
  });
  closeSheet();
}

// Geins exposes variant attributes as `{ key, value }` on the GraphQL
// fragment, while the SDK/legacy shape uses `{ attributeName, attributeValue }`.
// Tolerate both so real payloads and unit fixtures resolve the same way.
function attrName(attr: {
  attributeName?: string;
  key?: string;
}): string | undefined {
  return attr.attributeName ?? attr.key;
}
function attrValue(attr: {
  attributeValue?: string;
  value?: string;
}): string | undefined {
  return attr.attributeValue ?? attr.value;
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
  return props.variants.some((variant) => {
    const attrs = Array.isArray(variant.attributes) ? variant.attributes : [];
    if (attrs.length === 0) return true;

    const hasAttribute = attrs.some(
      (attr) => attrName(attr) === dimensionName && attrValue(attr) === value,
    );
    if (!hasAttribute) return false;

    for (const [dimName, dimValue] of Object.entries(props.modelValue)) {
      if (dimName === dimensionName) continue;
      const matches = attrs.some(
        (attr) => attrName(attr) === dimName && attrValue(attr) === dimValue,
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

const { showStock } = useStockVisibility();
const { showPrice } = usePriceVisibility();
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="variant-selector">
    <div
      v-for="dimension in groupedDimensions"
      :key="dimension.dimensionName"
      class="flex flex-col gap-1.5"
    >
      <span class="font-medium">
        {{ dimension.dimensionName }}
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
            modelValue[dimension.dimensionName] ||
            $t('product.select_variant_placeholder')
          }}
        </span>
        <ChevronDown class="size-4 shrink-0 opacity-50" />
      </Button>
    </div>

    <Sheet
      :open="openDimension !== null"
      @update:open="(v) => !v && closeSheet()"
    >
      <SheetContent
        side="right"
        class="flex h-screen w-full flex-col p-0 sm:max-w-[670px]"
        data-testid="variant-sheet"
      >
        <SheetHeader class="border-b px-6 py-4">
          <SheetTitle class="text-lg">
            {{
              activeDimension
                ? `${$t('product.select_variant')} — ${activeDimension.dimensionName}`
                : $t('product.select_variant')
            }}
          </SheetTitle>
        </SheetHeader>

        <div v-if="activeDimension" class="border-b px-6 py-3">
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
          v-if="activeDimension"
          class="flex-1 overflow-y-auto px-6 py-4"
          data-testid="variant-sheet-options"
        >
          <ul class="flex flex-col gap-2">
            <li
              v-for="value in filteredValues(activeDimension.values)"
              :key="value"
            >
              <button
                type="button"
                :disabled="
                  !isValueSelectable(activeDimension.dimensionName, value)
                "
                :class="[
                  'border-border hover:border-foreground/40 flex w-full items-center gap-3 rounded-md border bg-transparent p-3 text-left transition-colors',
                  modelValue[activeDimension.dimensionName] === value
                    ? 'border-foreground'
                    : '',
                  !isValueSelectable(activeDimension.dimensionName, value)
                    ? 'pointer-events-none opacity-40'
                    : '',
                ]"
                :aria-pressed="
                  modelValue[activeDimension.dimensionName] === value
                "
                @click="selectValue(activeDimension.dimensionName, value)"
              >
                <!-- Thumbnail uses the product's primary image. Geins
                     doesn't expose per-variant imagery; this keeps the
                     visual rhythm of the list consistent with Figma. -->
                <div
                  class="bg-muted size-12 shrink-0 overflow-hidden rounded-md"
                >
                  <GeinsImage
                    v-if="primaryImageFileName"
                    :file-name="primaryImageFileName"
                    type="product"
                    :alt="thumbnailAlt(activeDimension.dimensionName, value)"
                    class="size-full object-contain"
                  />
                </div>

                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm font-medium">
                    {{ rowProductName(activeDimension.dimensionName, value) }}
                  </div>
                  <div class="text-muted-foreground truncate text-sm">
                    {{ value }}
                  </div>
                  <div
                    v-if="
                      variantInfoFor(activeDimension.dimensionName, value)
                        ?.articleNumber
                    "
                    class="text-muted-foreground mt-0.5 truncate text-xs"
                  >
                    {{
                      $t('product.article_number', {
                        number: variantInfoFor(
                          activeDimension.dimensionName,
                          value,
                        )?.articleNumber,
                      })
                    }}
                  </div>
                  <div
                    v-if="showStock"
                    class="mt-1 flex items-center gap-1 text-xs"
                    :class="
                      isValueInStock(activeDimension.dimensionName, value)
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-muted-foreground'
                    "
                  >
                    <span
                      class="size-1.5 rounded-full"
                      :class="
                        isValueInStock(activeDimension.dimensionName, value)
                          ? 'bg-emerald-500'
                          : 'bg-muted-foreground'
                      "
                    />
                    {{
                      isValueInStock(activeDimension.dimensionName, value)
                        ? $t('product.in_stock')
                        : $t('product.out_of_stock')
                    }}
                  </div>
                </div>

                <!-- Price column: prefer each sibling variant's own
                     resolved price (passed via variantProducts), then
                     fall back to the parent's price. Hide entirely when
                     no formatted price is available or pricing is off. -->
                <span
                  v-if="
                    showPrice &&
                    (variantInfoFor(activeDimension.dimensionName, value)
                      ?.priceFormatted ||
                      priceFormatted)
                  "
                  class="shrink-0 text-sm font-medium"
                >
                  {{
                    variantInfoFor(activeDimension.dimensionName, value)
                      ?.priceFormatted || priceFormatted
                  }}
                </span>

                <Check
                  v-if="modelValue[activeDimension.dimensionName] === value"
                  class="size-4 shrink-0"
                />
              </button>
            </li>
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
