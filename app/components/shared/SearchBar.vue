<script setup lang="ts">
import { Search, X } from 'lucide-vue-next';

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

const query = ref(props.modelValue);

watch(
  () => props.modelValue,
  (val) => {
    query.value = val;
  },
);

function onSubmit() {
  const trimmed = query.value.trim();
  if (trimmed) {
    emit('search', trimmed);
  }
}

function onClear() {
  query.value = '';
  emit('update:modelValue', '');
}
</script>

<template>
  <div class="relative flex w-full max-w-md items-center">
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
  </div>
</template>
