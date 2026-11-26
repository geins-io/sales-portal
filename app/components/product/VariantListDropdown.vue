<script setup lang="ts">
import { Check, ChevronDown, Search } from 'lucide-vue-next';
import { ListboxFilter } from 'reka-ui';
import {
  VARIANT_LIST_HEIGHT,
  VARIANT_TRIGGER_CLASS,
  filterRows,
  showsSearch,
  type VariantRow,
} from '~/utils/variant-rows';
import { Button } from '~/components/ui/button';
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from '~/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';

/**
 * Every variant, or every SKU, in one dropdown list. No thumbnails: the
 * dropdown stays compact, and a store that wants them chooses the panel.
 */
const props = defineProps<{
  kind: 'variant' | 'sku';
  rows: VariantRow[];
  disabled?: boolean;
}>();

const emit = defineEmits<{ select: [key: string] }>();

const { t } = useI18n();
const { showStock } = useStockVisibility();
const { showPrice } = usePriceVisibility();

const isOpen = ref(false);
const query = ref('');
watch(isOpen, (now) => {
  if (!now) query.value = '';
});

function open() {
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
const picked = computed(() => props.rows.find((r) => r.selected) ?? null);
const showSearch = computed(() => showsSearch(props.rows));
// Command filters on each row's whole text, price and stock included; the
// list is filtered here instead, on the values and the article number.
const visibleRows = computed(() => filterRows(props.rows, query.value));

function pick(row: VariantRow) {
  isOpen.value = false;
  emit('select', row.key);
}
</script>

<template>
  <div class="flex flex-col gap-1.5" :data-testid="`${kind}-dropdown`">
    <span :id="labelId" class="text-sm font-medium">{{ heading }}</span>
    <Popover :open="isOpen" @update:open="(v) => (isOpen = v)">
      <PopoverTrigger as-child>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          :aria-expanded="isOpen"
          :aria-labelledby="`${labelId} ${valueId}`"
          :class="VARIANT_TRIGGER_CLASS"
          :disabled="disabled"
          :data-testid="`${kind}-dropdown-trigger`"
        >
          <span :id="valueId" class="truncate">{{
            picked ? picked.label : $t('product.select_variant_placeholder')
          }}</span>
          <!-- Down: the list opens below. -->
          <ChevronDown class="size-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        class="w-(--reka-popover-trigger-width) min-w-72 p-0"
        :data-testid="`${kind}-dropdown-content`"
      >
        <Command :model-value="picked?.key ?? ''">
          <div
            v-if="showSearch"
            class="flex items-center gap-2 border-b px-3"
            :data-testid="`${kind}-dropdown-search`"
          >
            <Search class="size-4 shrink-0 opacity-50" aria-hidden="true" />
            <ListboxFilter
              v-model="query"
              :placeholder="$t('product.variant_search_placeholder')"
              :aria-label="$t('product.variant_search_placeholder')"
              class="placeholder:text-muted-foreground flex h-11 w-full bg-transparent text-sm outline-hidden"
            />
          </div>
          <p
            v-if="!visibleRows.length"
            class="text-muted-foreground py-6 text-center text-sm"
            :data-testid="`${kind}-dropdown-empty`"
          >
            {{ $t('product.variant_no_match') }}
          </p>
          <CommandList :class="VARIANT_LIST_HEIGHT">
            <CommandGroup class="p-0">
              <CommandItem
                v-for="row in visibleRows"
                :key="row.key"
                :value="row.key"
                class="group border-border items-start gap-3 rounded-none border-b p-3 last:border-b-0"
                :data-testid="`${kind}-dropdown-option`"
                :data-value="row.key"
                @select="pick(row)"
              >
                <!-- The check's column only once a row is picked. -->
                <Check
                  v-if="picked"
                  class="mt-0.5 size-4 shrink-0"
                  :class="row.selected ? 'opacity-100' : 'opacity-0'"
                  aria-hidden="true"
                  :data-testid="`${kind}-dropdown-check`"
                />
                <span class="min-w-0 flex-1">
                  <span class="block truncate font-medium">{{
                    row.label
                  }}</span>
                  <!-- Darker on the highlighted row, so the grey text keeps AA
                       on the highlight. -->
                  <span
                    class="text-muted-foreground group-data-highlighted:text-foreground/70 mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs"
                    :data-testid="`${kind}-dropdown-meta`"
                  >
                    <span v-if="row.articleNumber">{{
                      $t('product.article_number', {
                        number: row.articleNumber,
                      })
                    }}</span>
                    <StockIndicator
                      v-if="showStock"
                      :stock="row.stock"
                      :status="row.stock ? null : 'out-of-stock'"
                      size="sm"
                    />
                  </span>
                </span>
                <span
                  v-if="showPrice && row.price"
                  class="ml-auto shrink-0 text-sm font-medium tabular-nums"
                  :data-testid="`${kind}-dropdown-price`"
                >
                  {{ row.price }}
                </span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  </div>
</template>
