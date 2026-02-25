<script setup lang="ts">
import { Search } from 'lucide-vue-next';
import { Input } from '~/components/ui/input';

defineProps<{
  resultCount: number;
  sortValue: string;
  sortOptions: { label: string; value: string }[];
  viewMode: 'grid' | 'list';
  filterText?: string;
  hasActiveFilters?: boolean;
}>();

const emit = defineEmits<{
  'update:sortValue': [value: string];
  'update:viewMode': [value: 'grid' | 'list'];
  'update:filterText': [value: string];
  'reset-filters': [];
  'toggle-filters': [];
}>();

const { t } = useI18n();
</script>

<template>
  <div class="space-y-2">
    <!-- Row 1: Filters button (left) | View toggle (right) -->
    <div class="flex items-center gap-2">
      <slot name="filters" />
      <Button
        v-if="hasActiveFilters"
        variant="outline"
        size="sm"
        @click="emit('reset-filters')"
      >
        {{ t('product.clear_all') }}
      </Button>
      <div class="flex-1" />
      <span class="text-muted-foreground hidden text-sm sm:inline">{{
        t('product.view_as')
      }}</span>
      <ProductViewToggle
        :model-value="viewMode"
        @update:model-value="emit('update:viewMode', $event)"
      />
    </div>

    <!-- Row 2: Search input (left) | Sort dropdown (right) -->
    <div class="flex items-center gap-2">
      <div class="relative w-full max-w-xs">
        <Search
          class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
        />
        <Input
          :model-value="filterText ?? ''"
          :placeholder="t('product.quick_filter_placeholder')"
          class="pl-9"
          @update:model-value="emit('update:filterText', String($event))"
        />
      </div>
      <div class="flex-1" />
      <ProductSortDropdown
        :model-value="sortValue"
        :options="sortOptions"
        @update:model-value="emit('update:sortValue', $event)"
      />
    </div>
  </div>
</template>
