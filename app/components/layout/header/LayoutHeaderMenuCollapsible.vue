<script setup lang="ts">
import type { MenuItemType } from '#shared/types/cms';
import LayoutHeaderMenuCollapsibleItem from './LayoutHeaderMenuCollapsibleItem.vue';

const props = defineProps<{
  /** The open top item's children. */
  items: MenuItemType[];
}>();

const COLUMNS = 4;

// Row by row, as the mega menu reads: item 1 in column 1, item 5 under it.
// Each column is its own stack, so an open heading moves only its column.
const columns = computed(() =>
  Array.from({ length: COLUMNS }, (_, c) =>
    props.items.filter((_, i) => i % COLUMNS === c),
  ),
);
</script>

<template>
  <div
    class="grid grid-cols-4 items-start gap-x-8"
    data-testid="menu-collapsible"
  >
    <ul v-for="(column, c) in columns" :key="c" class="flex flex-col gap-1">
      <LayoutHeaderMenuCollapsibleItem
        v-for="item in column"
        :key="item.id"
        :item="item"
      />
    </ul>
  </div>
</template>
