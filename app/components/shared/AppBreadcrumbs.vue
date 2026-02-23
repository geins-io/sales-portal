<script setup lang="ts">
import type { BreadcrumbItem } from '#shared/types/common';
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem as BreadcrumbItemPrimitive,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '~/components/ui/breadcrumb';

type DisplayItem = BreadcrumbItem & { _ellipsis?: boolean };

const props = defineProps<{
  items: BreadcrumbItem[];
}>();

// Collapse when hiding 2+ items (5+ total) — hiding a single item is worse UX than showing all
const COLLAPSE_MIN_ITEMS = 5;

const shouldCollapse = computed(() => props.items.length >= COLLAPSE_MIN_ITEMS);

const displayItems = computed((): DisplayItem[] => {
  if (!shouldCollapse.value) return props.items;
  // Show first, ellipsis, and last two
  return [
    props.items[0]!,
    { label: '...', _ellipsis: true },
    ...props.items.slice(-2),
  ];
});
</script>

<template>
  <Breadcrumb v-if="items.length">
    <BreadcrumbList>
      <template v-for="(item, index) in displayItems" :key="index">
        <BreadcrumbItemPrimitive>
          <!-- Ellipsis -->
          <BreadcrumbEllipsis
            v-if="(item as DisplayItem)._ellipsis"
            class="hidden md:flex"
          />

          <!-- Last item: current page -->
          <BreadcrumbPage v-else-if="index === displayItems.length - 1">
            {{ item.label }}
          </BreadcrumbPage>

          <!-- Regular item: link -->
          <BreadcrumbLink v-else as-child>
            <NuxtLink :to="item.href ?? '/'">
              {{ item.label }}
            </NuxtLink>
          </BreadcrumbLink>
        </BreadcrumbItemPrimitive>

        <!-- Separator (not after last item) -->
        <BreadcrumbSeparator v-if="index < displayItems.length - 1" />
      </template>
    </BreadcrumbList>
  </Breadcrumb>
</template>
