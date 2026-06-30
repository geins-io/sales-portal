<script setup lang="ts">
import type { FilterFacet } from '#shared/types/commerce';
import { SlidersHorizontal } from 'lucide-vue-next';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import { getFilterGroupLabel } from '~/utils/filter-labels';

const props = defineProps<{
  facets: FilterFacet[];
  modelValue: Record<string, string[]>;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, string[]>];
}>();

const { t } = useI18n();

const sheetOpen = ref(false);

function updateFacet(facetId: string, selected: string[]) {
  if (selected.length === 0) {
    const { [facetId]: _, ...rest } = props.modelValue;
    emit('update:modelValue', rest);
  } else {
    emit('update:modelValue', { ...props.modelValue, [facetId]: selected });
  }
}

function getSelected(facetId: string): string[] {
  return props.modelValue[facetId] ?? [];
}

const hasSelectedFilters = computed(
  () => Object.keys(props.modelValue).length > 0,
);

const activeFilterCount = computed(() =>
  Object.values(props.modelValue).reduce((sum, arr) => sum + arr.length, 0),
);

const filterSearch = ref('');

const filteredFacets = computed<FilterFacet[]>(() => {
  const query = filterSearch.value.toLowerCase().trim();
  if (!query) return props.facets;
  return props.facets
    .map((facet) => {
      const displayed = getFilterGroupLabel(facet, t).toLowerCase();
      if (displayed.includes(query)) return facet;
      const matchingValues = facet.values.filter(
        (v) => !v.hidden && (v.label ?? '').toLowerCase().includes(query),
      );
      if (matchingValues.length === 0) return null;
      return { ...facet, values: matchingValues };
    })
    .filter((f): f is FilterFacet => f !== null);
});

function clearAll() {
  emit('update:modelValue', {});
}
</script>

<template>
  <div>
    <Button
      size="sm"
      class="px-[15px]"
      data-testid="product-filters"
      @click="sheetOpen = true"
    >
      <SlidersHorizontal class="mr-2 size-4" />
      {{ $t('product.filters') }}
    </Button>

    <Sheet v-model:open="sheetOpen">
      <!-- Don't let the sheet auto-focus the filter-search input on open:
           on mobile that pops the soft keyboard and hides the filters the
           user came to browse. Focus stays on the trigger; tapping the
           field still focuses it normally. -->
      <SheetContent
        side="left"
        class="flex h-dvh flex-col overflow-hidden"
        @open-auto-focus.prevent
      >
        <SheetHeader class="px-6 pb-4">
          <SheetTitle class="text-xl font-bold">
            {{ $t('product.filters') }}
            <span v-if="activeFilterCount > 0"> ({{ activeFilterCount }})</span>
          </SheetTitle>
        </SheetHeader>

        <!-- Search filters -->
        <div class="border-b px-6 pb-4">
          <Input
            v-model="filterSearch"
            :placeholder="$t('product.search_filters')"
            class="w-full"
          />
        </div>

        <!-- Filter groups -->
        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div class="space-y-0">
            <FilterGroup
              v-for="facet in filteredFacets"
              :key="facet.filterId"
              :facet="facet"
              :selected="getSelected(facet.filterId)"
              @update:selected="updateFacet(facet.filterId, $event)"
            />
          </div>
        </div>

        <!-- Footer: narrower grey Clear all on the left, Show results fills the rest -->
        <div class="flex shrink-0 items-center gap-3 border-t px-6 py-4">
          <Button
            variant="secondary"
            :disabled="!hasSelectedFilters"
            @click="clearAll"
          >
            {{ $t('product.clear_all') }}
          </Button>
          <Button class="flex-1" @click="sheetOpen = false">
            {{ $t('product.show_results') }}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
