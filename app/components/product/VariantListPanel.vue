<script setup lang="ts">
import { ChevronRight, Search } from 'lucide-vue-next';
import {
  VARIANT_TRIGGER_CLASS,
  filterRows,
  showsSearch,
  type VariantRow,
} from '~/utils/variant-rows';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';

/** Every variant, or every SKU, in one list in a panel from the side. */
const props = defineProps<{
  kind: 'variant' | 'sku';
  rows: VariantRow[];
  disabled?: boolean;
}>();

const emit = defineEmits<{ select: [key: string] }>();

const { t } = useI18n();
const { showStock } = useStockVisibility();
const { showPrice } = usePriceVisibility();
const { buildProductImageAlt } = useProductImageAlt();

const isOpen = ref(false);
const query = ref('');

function open() {
  query.value = '';
  isOpen.value = true;
}

defineExpose({ open });

const labelId = useId();
const valueId = useId();
const heading = computed(() =>
  t(
    props.kind === 'sku'
      ? 'product.variant_heading'
      : 'product.variant_dimension_heading',
  ),
);
const sheetTitle = computed(() =>
  t(props.kind === 'sku' ? 'product.select_type' : 'product.select_variant'),
);
const picked = computed(() => props.rows.find((r) => r.selected) ?? null);
const showSearch = computed(() => showsSearch(props.rows));
const visibleRows = computed(() => filterRows(props.rows, query.value));

function pick(row: VariantRow) {
  isOpen.value = false;
  emit('select', row.key);
}
</script>

<template>
  <div class="flex flex-col gap-1.5" :data-testid="`${kind}-list`">
    <span :id="labelId" class="text-sm font-medium">{{ heading }}</span>
    <Button
      type="button"
      variant="outline"
      :class="VARIANT_TRIGGER_CLASS"
      :aria-labelledby="`${labelId} ${valueId}`"
      :disabled="disabled"
      :data-testid="`${kind}-list-trigger`"
      @click="open"
    >
      <span :id="valueId" class="truncate">{{
        picked ? picked.label : $t('product.select_variant_placeholder')
      }}</span>
      <!-- Right: the panel opens from the side. -->
      <ChevronRight class="size-4 shrink-0 opacity-50" aria-hidden="true" />
    </Button>

    <Sheet :open="isOpen" @update:open="(v) => (isOpen = v)">
      <!-- No auto-focus on the search, or the phone keyboard hides the list. -->
      <SheetContent
        side="right"
        class="flex h-screen w-full flex-col gap-0 p-0 sm:max-w-[670px]"
        :data-testid="`${kind}-list-sheet`"
        @open-auto-focus.prevent
      >
        <SheetHeader class="border-b px-6 py-4">
          <SheetTitle class="text-lg">{{ sheetTitle }}</SheetTitle>
        </SheetHeader>
        <div v-if="showSearch" class="border-b px-6 py-3">
          <div class="relative">
            <Search
              class="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              v-model="query"
              type="search"
              :placeholder="$t('product.variant_search_placeholder')"
              :aria-label="$t('product.variant_search_placeholder')"
              class="pl-9"
              :data-testid="`${kind}-list-search`"
            />
          </div>
        </div>
        <div class="flex-1 overflow-y-auto px-6 py-4">
          <p
            v-if="!visibleRows.length"
            class="text-muted-foreground py-6 text-center text-sm"
            :data-testid="`${kind}-list-empty`"
          >
            {{ $t('product.variant_no_match') }}
          </p>
          <ul v-else class="flex flex-col gap-2">
            <li v-for="row in visibleRows" :key="row.key">
              <VariantSheetRow
                :data-testid="`${kind}-list-option`"
                :data-value="row.key"
                :image-file-name="row.image?.fileName ?? null"
                :image-url="row.image?.url ?? null"
                :image-missing="row.image === null"
                :image-alt="buildProductImageAlt({ name: row.name })"
                :title="row.label"
                :subtitle="row.name"
                :article-number="row.articleNumber"
                :show-stock="showStock"
                :stock="row.stock"
                :price="showPrice ? row.price : null"
                :selected="row.selected"
                @click="pick(row)"
              />
            </li>
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
