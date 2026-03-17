<script setup lang="ts">
import type { FilterFacet } from '#shared/types/commerce';
import { SlidersHorizontal } from 'lucide-vue-next';
import { Button } from '~/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';

const props = defineProps<{
  facets: FilterFacet[];
  modelValue: Record<string, string[]>;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, string[]>];
}>();

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

function clearAll() {
  emit('update:modelValue', {});
}
</script>

<template>
  <div>
    <Button size="sm" data-testid="product-filters" @click="sheetOpen = true">
      <SlidersHorizontal class="mr-2 size-4" />
      {{ $t('product.filters') }}
    </Button>

    <Sheet v-model:open="sheetOpen">
      <SheetContent side="left" class="flex flex-col overflow-hidden">
        <SheetHeader class="border-b px-6 pb-4">
          <SheetTitle>{{ $t('product.filters') }}</SheetTitle>
        </SheetHeader>
        <div class="flex-1 overflow-y-auto px-6 py-4">
          <div class="space-y-2">
            <FilterGroup
              v-for="facet in facets"
              :key="facet.filterId"
              :facet="facet"
              :selected="getSelected(facet.filterId)"
              @update:selected="updateFacet(facet.filterId, $event)"
            />
          </div>
        </div>
        <div v-if="hasSelectedFilters" class="border-t px-6 py-4">
          <Button variant="outline" class="w-full" @click="clearAll">
            {{ $t('product.clear_all') }}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
