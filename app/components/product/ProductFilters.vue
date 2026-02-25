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
</script>

<template>
  <div>
    <Button size="sm" @click="sheetOpen = true">
      <SlidersHorizontal class="mr-2 size-4" />
      {{ $t('product.filters') }}
    </Button>

    <Sheet v-model:open="sheetOpen">
      <SheetContent side="left" class="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{{ $t('product.filters') }}</SheetTitle>
        </SheetHeader>
        <div class="mt-4 space-y-1">
          <FilterGroup
            v-for="facet in facets"
            :key="facet.filterId"
            :facet="facet"
            :selected="getSelected(facet.filterId)"
            @update:selected="updateFacet(facet.filterId, $event)"
          />
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
