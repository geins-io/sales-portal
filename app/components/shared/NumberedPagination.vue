<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';

const props = defineProps<{
  currentPage: number;
  totalPages: number;
}>();

const emit = defineEmits<{
  'update:currentPage': [page: number];
}>();

const { t } = useI18n();

const isFirstPage = computed(() => props.currentPage <= 1);
const isLastPage = computed(() => props.currentPage >= props.totalPages);

/**
 * Build an array of page numbers and ellipsis markers.
 * Always shows first, last, and up to 2 pages around current.
 * Example for page 5 of 10: [1, '...', 4, 5, 6, '...', 10]
 */
const visiblePages = computed(() => {
  const total = props.totalPages;
  const current = props.currentPage;

  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | '...')[] = [];

  // Always show page 1
  pages.push(1);

  if (current > 3) {
    pages.push('...');
  }

  // Pages around current
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push('...');
  }

  // Always show last page
  pages.push(total);

  return pages;
});

function goToPage(page: number) {
  if (page < 1 || page > props.totalPages || page === props.currentPage) return;
  emit('update:currentPage', page);
}
</script>

<template>
  <nav
    v-if="totalPages > 1"
    :aria-label="t('pagination.navigation')"
    class="flex items-center justify-end gap-1"
  >
    <button
      :disabled="isFirstPage"
      class="hover:bg-accent inline-flex h-9 items-center gap-1 rounded-md px-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50"
      @click="goToPage(currentPage - 1)"
    >
      <ChevronLeft class="size-4" />
      {{ t('pagination.previous') }}
    </button>

    <template v-for="(page, index) in visiblePages" :key="index">
      <span
        v-if="page === '...'"
        class="text-muted-foreground flex size-9 items-center justify-center text-sm"
      >
        &hellip;
      </span>
      <button
        v-else
        :class="[
          'inline-flex size-9 items-center justify-center rounded-md text-sm font-medium transition-colors',
          page === currentPage
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-accent',
        ]"
        :aria-current="page === currentPage ? 'page' : undefined"
        @click="goToPage(page)"
      >
        {{ page }}
      </button>
    </template>

    <button
      :disabled="isLastPage"
      class="hover:bg-accent inline-flex h-9 items-center gap-1 rounded-md px-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50"
      @click="goToPage(currentPage + 1)"
    >
      {{ t('pagination.next') }}
      <ChevronRight class="size-4" />
    </button>
  </nav>
</template>
