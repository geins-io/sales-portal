<script setup lang="ts">
import type { FilterFacet } from '#shared/types/commerce';
import { X } from 'lucide-vue-next';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';

const { t } = useI18n();

const props = defineProps<{
  filters: Record<string, string[]>;
  facets: FilterFacet[];
}>();

const emit = defineEmits<{
  remove: [facetId: string, valueId: string];
  'clear-all': [];
}>();

interface ActiveFilter {
  facetId: string;
  facetLabel: string;
  valueId: string;
  valueLabel: string;
}

const activeFilters = computed<ActiveFilter[]>(() => {
  const result: ActiveFilter[] = [];
  for (const [facetId, valueIds] of Object.entries(props.filters)) {
    const facet = props.facets.find((f) => f.filterId === facetId);
    if (!facet) continue;
    for (const valueId of valueIds) {
      const value = facet.values.find((v) => v.facetId === valueId);
      if (!value) continue;
      result.push({
        facetId,
        facetLabel: facet.label || facet.type || facet.filterId,
        valueId,
        valueLabel: value.label,
      });
    }
  }
  return result;
});

const hasActiveFilters = computed(() => activeFilters.value.length > 0);
</script>

<template>
  <div v-if="hasActiveFilters" class="flex flex-wrap items-center gap-2">
    <Badge
      v-for="filter in activeFilters"
      :key="`${filter.facetId}-${filter.valueId}`"
      variant="secondary"
      class="gap-1 pr-1"
    >
      {{ filter.valueLabel }}
      <Button
        variant="ghost"
        class="size-auto rounded-full p-0.5"
        :aria-label="t('product.remove_filter', { name: filter.valueLabel })"
        @click="emit('remove', filter.facetId, filter.valueId)"
      >
        <X class="size-3" />
      </Button>
    </Badge>
  </div>
</template>
