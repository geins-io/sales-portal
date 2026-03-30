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
const { localePath } = useLocaleMarket();

const query = ref(props.modelValue);
const autocompleteOpen = ref(false);
const autocompleteResults = ref<ProductListResponse | null>(null);
const autocompleteLoading = ref(false);
const containerRef = ref<HTMLElement | null>(null);
const activeIndex = ref(-1);

const autocompleteItems = computed(
  () => autocompleteResults.value?.products.slice(0, 5) ?? [],
);

watch(
  () => props.modelValue,
  (val) => {
    query.value = val;
  },
);

// Reset activeIndex when dropdown closes or results change
watch(autocompleteOpen, (open) => {
  if (!open) activeIndex.value = -1;
});
watch(autocompleteResults, () => {
  activeIndex.value = -1;
});

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
    autocompleteOpen.value = false;
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
  if (
    activeIndex.value >= 0 &&
    autocompleteOpen.value &&
    autocompleteItems.value[activeIndex.value]
  ) {
    const product = autocompleteItems.value[activeIndex.value]!;
    autocompleteOpen.value = false;
    router.push(localePath(`/${product.alias}`));
    return;
  }
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
  router.push(localePath(`/${alias}`));
}

function onViewAll() {
  autocompleteOpen.value = false;
  const trimmed = query.value.trim();
  if (trimmed) {
    router.push({ path: localePath('/search'), query: { q: trimmed } });
  }
}

function onCloseAutocomplete() {
  autocompleteOpen.value = false;
}

function onArrowDown() {
  if (!autocompleteOpen.value || autocompleteItems.value.length === 0) return;
  activeIndex.value =
    activeIndex.value < autocompleteItems.value.length - 1
      ? activeIndex.value + 1
      : 0;
}

function onArrowUp() {
  if (!autocompleteOpen.value || autocompleteItems.value.length === 0) return;
  activeIndex.value =
    activeIndex.value > 0
      ? activeIndex.value - 1
      : autocompleteItems.value.length - 1;
}

function onEscape() {
  autocompleteOpen.value = false;
  activeIndex.value = -1;
}

const activeDescendant = computed(() =>
  activeIndex.value >= 0 ? `search-result-${activeIndex.value}` : undefined,
);
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
      data-testid="search-input"
      role="combobox"
      :aria-expanded="autocompleteOpen"
      :aria-activedescendant="activeDescendant"
      aria-autocomplete="list"
      aria-controls="search-listbox"
      :placeholder="placeholder ?? $t('nav.search_products')"
      class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border py-2 pr-10 pl-10 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      @keydown.enter="onSubmit"
      @keydown.down.prevent="onArrowDown"
      @keydown.up.prevent="onArrowUp"
      @keydown.escape="onEscape"
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
      :active-index="activeIndex"
      @select-product="onSelectProduct"
      @view-all="onViewAll"
      @close="onCloseAutocomplete"
    />
  </div>
</template>
