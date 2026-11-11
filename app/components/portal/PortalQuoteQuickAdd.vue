<script setup lang="ts">
/**
 * Quick product add on a request draft: type a name or an article number and
 * pick a hit; it goes on the draft that is open. An ARIA combobox: the arrows
 * move, Enter adds the highlighted hit (the first addable one when none is,
 * waiting for results still on their way), Escape closes. The field clears
 * and keeps focus, so several products can be added in a row.
 */
import { Loader2, Plus, Search } from 'lucide-vue-next';
import { onClickOutside, useDebounceFn } from '@vueuse/core';
import type { ListProduct, ProductListResponse } from '#shared/types/commerce';
import { quickAddChoice, type QuickAddChoice } from '~/utils/quote-quick-add';

/** Fewer characters than this search nothing. */
const MIN_QUERY = 2;
const MAX_HITS = 6;
const SEARCH_DELAY_MS = 250;

const props = defineProps<{
  /** True while an add is being saved. */
  pending?: boolean;
}>();

const emit = defineEmits<{
  add: [product: { skuId: number; name: string }];
}>();

const { t } = useI18n();
const { showIncVat } = useVatDisplay();

interface Hit {
  product: ListProduct;
  choice: QuickAddChoice;
}

const query = ref('');
const hits = ref<Hit[]>([]);
const open = ref(false);
const loading = ref(false);
const activeIndex = ref(-1);
const containerRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);

onClickOutside(containerRef, () => {
  open.value = false;
});

const addable = (hit: Hit | undefined) => !!hit && 'skuId' in hit.choice;

let requestSeq = 0;
/** Enter came before the hits: add the first addable one when they arrive. */
let enterWhenReady = false;

const search = useDebounceFn(async (q: string) => {
  const seq = ++requestSeq;
  loading.value = true;
  try {
    const data = await $fetch<ProductListResponse>('/api/search/products', {
      query: { query: q, take: MAX_HITS },
    });
    // A slower, older answer must not overwrite a newer one.
    if (seq !== requestSeq) return;
    hits.value = data.products.slice(0, MAX_HITS).map((product) => ({
      product,
      choice: quickAddChoice(product),
    }));
    activeIndex.value = hits.value.findIndex(addable);
    open.value = true;
    if (enterWhenReady) {
      enterWhenReady = false;
      choose(hits.value[activeIndex.value]);
    }
  } catch {
    if (seq === requestSeq) {
      hits.value = [];
      open.value = true;
    }
  } finally {
    if (seq === requestSeq) loading.value = false;
  }
}, SEARCH_DELAY_MS);

watch(query, (value) => {
  enterWhenReady = false;
  const q = value.trim();
  if (q.length < MIN_QUERY) {
    requestSeq++;
    hits.value = [];
    open.value = false;
    loading.value = false;
    return;
  }
  void search(q);
});

function choose(hit: Hit | undefined) {
  if (!hit || props.pending || !('skuId' in hit.choice)) return;
  emit('add', { skuId: hit.choice.skuId, name: hit.product.name });
  query.value = '';
  open.value = false;
  nextTick(() => inputRef.value?.focus());
}

function onEnter() {
  if (!open.value || loading.value) {
    enterWhenReady = query.value.trim().length >= MIN_QUERY;
    return;
  }
  const active = hits.value[activeIndex.value];
  choose(addable(active) ? active : hits.value.find(addable));
}

function move(step: 1 | -1) {
  if (!open.value || !hits.value.length) return;
  const n = hits.value.length;
  activeIndex.value = (activeIndex.value + step + n) % n;
}

function blockedHint(choice: QuickAddChoice): string {
  if (!('blocked' in choice)) return '';
  if (choice.blocked === 'configurable') {
    return t('portal.quotations.draft.quick_add_configurable');
  }
  if (choice.blocked === 'variants') {
    return t('portal.quotations.draft.quick_add_variants');
  }
  return '';
}

const activeDescendant = computed(() =>
  open.value && activeIndex.value >= 0
    ? `quick-add-hit-${activeIndex.value}`
    : undefined,
);
</script>

<template>
  <div ref="containerRef" class="relative" data-testid="quote-quick-add">
    <label for="quote-quick-add-input" class="sr-only">
      {{ t('portal.quotations.draft.quick_add_label') }}
    </label>
    <div class="relative">
      <Search
        class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
      />
      <input
        id="quote-quick-add-input"
        ref="inputRef"
        v-model="query"
        type="text"
        role="combobox"
        autocomplete="off"
        data-testid="quote-quick-add-input"
        :aria-expanded="open"
        :aria-activedescendant="activeDescendant"
        aria-autocomplete="list"
        aria-controls="quote-quick-add-listbox"
        aria-describedby="quote-quick-add-hint"
        :placeholder="t('portal.quotations.draft.quick_add_placeholder')"
        class="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring/50 focus-visible:border-ring flex h-10 w-full rounded-md border py-2 pr-10 pl-10 text-sm focus-visible:ring-[3px] focus-visible:outline-none"
        @keydown.enter.prevent="onEnter"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.escape="open = false"
      />
      <Loader2
        v-if="loading || pending"
        data-testid="quote-quick-add-loading"
        class="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin"
      />
    </div>
    <p id="quote-quick-add-hint" class="sr-only">
      {{ t('portal.quotations.draft.quick_add_on_draft') }}
    </p>

    <ul
      v-if="open"
      id="quote-quick-add-listbox"
      role="listbox"
      data-testid="quote-quick-add-listbox"
      class="border-border bg-background absolute top-full right-0 z-30 mt-1 max-h-80 w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-md border py-1 shadow-lg"
    >
      <li
        v-if="!hits.length"
        data-testid="quote-quick-add-empty"
        class="text-muted-foreground px-3 py-3 text-sm"
      >
        {{
          t('portal.quotations.draft.quick_add_no_hits', { q: query.trim() })
        }}
      </li>
      <li
        v-for="(hit, i) in hits"
        :id="`quick-add-hit-${i}`"
        :key="hit.product.productId"
        role="option"
        :aria-selected="i === activeIndex"
        :aria-disabled="!addable(hit) || undefined"
        data-testid="quote-quick-add-hit"
        class="flex items-center gap-3 px-3 py-2"
        :class="[
          i === activeIndex ? 'bg-muted' : '',
          addable(hit) ? 'cursor-pointer' : 'cursor-default',
        ]"
        @mouseenter="activeIndex = i"
        @mousedown.prevent="choose(hit)"
      >
        <ProductThumbnail
          :file-name="hit.product.productImages?.[0]?.fileName"
          :alt="hit.product.name"
          size="size-9"
        />
        <div class="min-w-0 flex-1" :class="{ 'opacity-60': !addable(hit) }">
          <p class="truncate text-sm font-medium">{{ hit.product.name }}</p>
          <p class="text-muted-foreground text-xs">
            {{ hit.product.articleNumber }}
          </p>
          <p
            v-if="blockedHint(hit.choice)"
            data-testid="quote-quick-add-blocked"
            class="text-muted-foreground text-xs"
          >
            {{ blockedHint(hit.choice) }}
          </p>
        </div>
        <template v-if="addable(hit)">
          <span class="text-muted-foreground shrink-0 text-xs tabular-nums">{{
            showIncVat
              ? hit.product.unitPrice?.sellingPriceIncVatFormatted
              : hit.product.unitPrice?.sellingPriceExVatFormatted
          }}</span>
          <Plus class="text-muted-foreground size-4 shrink-0" />
        </template>
      </li>
    </ul>
  </div>
</template>
