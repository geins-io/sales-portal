<script setup lang="ts">
import { Search, X } from 'lucide-vue-next';
import { useDebounceFn, onClickOutside } from '@vueuse/core';
import type { ProductListResponse } from '#shared/types/commerce';

const props = withDefaults(
  defineProps<{
    placeholder?: string;
    modelValue?: string;
  }>(),
  {
    modelValue: '',
  },
);

const emit = defineEmits<{
  search: [query: string];
  'update:modelValue': [value: string];
}>();

const router = useRouter();

const query = ref(props.modelValue);
const autocompleteOpen = ref(false);
const autocompleteResults = ref<ProductListResponse | null>(null);
const autocompleteLoading = ref(false);
const containerRef = ref<HTMLElement | null>(null);

watch(
  () => props.modelValue,
  (val) => {
    query.value = val;
  },
);

// Close autocomplete on click outside
onClickOutside(containerRef, () => {
  autocompleteOpen.value = false;
});

// Debounced autocomplete fetch
const debouncedSearch = useDebounceFn(async (searchQuery: string) => {
  if (searchQuery.length < 2) {
    autocompleteResults.value = null;
    autocompleteOpen.value = false;
    return;
  }

  autocompleteLoading.value = true;
  autocompleteOpen.value = true;

  try {
    const data = await $fetch<ProductListResponse>('/api/search/products', {
      query: { query: searchQuery, take: 5 },
    });
    autocompleteResults.value = data;
  } catch {
    autocompleteResults.value = null;
  } finally {
    autocompleteLoading.value = false;
  }
}, 300);

// Watch query changes for autocomplete
watch(query, (val) => {
  const trimmed = val.trim();
  if (trimmed.length < 2) {
    autocompleteOpen.value = false;
    autocompleteResults.value = null;
    return;
  }
  debouncedSearch(trimmed);
});

function onSubmit() {
  const trimmed = query.value.trim();
  if (trimmed) {
    autocompleteOpen.value = false;
    emit('search', trimmed);
  }
}

function onClear() {
  query.value = '';
  autocompleteOpen.value = false;
  autocompleteResults.value = null;
  emit('update:modelValue', '');
}

function onSelectProduct(alias: string) {
  autocompleteOpen.value = false;
  router.push(`/p/${alias}`);
}

function onViewAll() {
  autocompleteOpen.value = false;
  const trimmed = query.value.trim();
  if (trimmed) {
    router.push({ path: '/search', query: { q: trimmed } });
  }
}

function onCloseAutocomplete() {
  autocompleteOpen.value = false;
}
</script>

<template>
  <div ref="containerRef" class="relative flex w-full max-w-md items-center">
    <Search
      data-slot="search-icon"
      class="text-muted-foreground pointer-events-none absolute left-3 size-4"
    />
    <input
      v-model="query"
      type="text"
      :placeholder="placeholder ?? $t('nav.search_products')"
      class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border py-2 pr-10 pl-10 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      @keydown.enter="onSubmit"
    />
    <button
      v-if="query.length > 0"
      data-slot="search-clear"
      type="button"
      class="text-muted-foreground hover:text-foreground absolute right-3 p-0.5"
      @click="onClear"
    >
      <X class="size-4" />
    </button>

    <!-- Autocomplete dropdown -->
    <SearchAutocomplete
      :results="autocompleteResults"
      :loading="autocompleteLoading"
      :open="autocompleteOpen"
      @select-product="onSelectProduct"
      @view-all="onViewAll"
      @close="onCloseAutocomplete"
    />
  </div>
</template>
