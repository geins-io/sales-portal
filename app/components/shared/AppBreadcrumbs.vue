<script setup lang="ts">
import type { BreadcrumbItem } from '#shared/types/common';
import { useElementSize, useEventListener } from '@vueuse/core';
import { ChevronRight } from 'lucide-vue-next';
import {
  Breadcrumb,
  BreadcrumbItem as BreadcrumbItemPrimitive,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from '~/components/ui/breadcrumb';

defineProps<{
  items: BreadcrumbItem[];
}>();

const { localePath } = useLocaleMarket();

const scroller = useTemplateRef<HTMLElement>('scroller');

// `border-box`: the pin's padding is part of what a focused crumb must clear.
const pin = ref<HTMLElement | null>(null);
const { width: pinWidth } = useElementSize(pin, undefined, {
  box: 'border-box',
});

// Geometry, not `scrollLeft`: `dir="rtl"` makes `scrollLeft === 0` the right-hand
// end. Starts false: measured, starting true washes the next chevron on every
// short trail until mount, and a deep trail missing its fade for one frame moves
// nothing.
const hasHiddenStart = ref(false);

function measure() {
  const box = scroller.value?.getBoundingClientRect();
  const list = scroller.value?.querySelector('ol')?.getBoundingClientRect();
  hasHiddenStart.value = !!box && !!list && list.left < box.left - 1;
}

useEventListener(scroller, 'scroll', measure, { passive: true });

// The browser will not do this itself. Measured in Chromium: shift-tabbing onto a
// partly visible crumb leaves `scrollLeft` untouched, so neither
// `scroll-padding-left` nor `scroll-margin-left` has any effect.
function keepFocusClearOfPin(event: FocusEvent) {
  const el = event.target;
  const box = scroller.value;
  if (!(el instanceof HTMLElement) || !box) return;

  const port = box.getBoundingClientRect();
  const crumb = el.getBoundingClientRect();
  // +1 absorbs the sub-pixel width.
  const guard =
    el.closest('li') === pin.value ? 0 : Math.ceil(pinWidth.value) + 1;

  const overlap = port.left + guard - crumb.left;
  if (overlap > 0) box.scrollLeft -= overlap;
  else if (crumb.right > port.right) box.scrollLeft += crumb.right - port.right;
}

useEventListener(scroller, 'focusin', keepFocusClearOfPin);

// A gradient, not `mask-image`, which has no fallback story here; off in forced
// colours, where it would render as a block. `site-background` because the trail
// sits on the body surface, not a card — `background` is #FFFFFF against #FAFAFA
// and paints the pin as a white patch.
const pinClass = computed(() => [
  'bg-site-background sticky left-0 z-10 pr-2',
  'after:pointer-events-none after:absolute after:top-0 after:left-full after:h-full after:w-6',
  'after:bg-linear-to-r after:from-site-background after:to-transparent',
  'forced-colors:after:hidden',
  hasHiddenStart.value ? '' : 'after:opacity-0',
]);

onMounted(() => {
  pin.value = scroller.value?.querySelector('li') ?? null;
  measure();
});
</script>

<template>
  <Breadcrumb v-if="items.length" data-testid="breadcrumbs">
    <!-- `rtl` scroller with `ltr` content puts the scroll origin at the right in
         the markup itself, so there is no position to jump from on hydration.
         Measured in all three engines: `justify-content: flex-end` leaves the far
         end unreachable in two. LTR-only. -->
    <div
      ref="scroller"
      data-testid="breadcrumbs-scroller"
      dir="rtl"
      class="scrollbar-none max-w-[32rem] overflow-x-auto py-1"
    >
      <!-- `min-w-full`: in an `rtl` scroller a narrower list would sit right. -->
      <BreadcrumbList
        dir="ltr"
        class="w-max min-w-full flex-nowrap whitespace-nowrap"
      >
        <template v-for="(item, index) in items" :key="index">
          <BreadcrumbItemPrimitive :class="index === 0 ? pinClass : undefined">
            <!-- Inside the crumb, not between two: a separator in its own <li>
                 is stranded beside the pin when its crumb scrolls under it. -->
            <ChevronRight
              v-if="index > 0"
              class="size-3.5"
              aria-hidden="true"
            />

            <BreadcrumbPage v-if="index === items.length - 1">
              {{ item.label }}
            </BreadcrumbPage>

            <BreadcrumbLink v-else as-child>
              <NuxtLink :to="localePath(item.href ?? '/')">
                {{ item.label }}
              </NuxtLink>
            </BreadcrumbLink>
          </BreadcrumbItemPrimitive>
        </template>
      </BreadcrumbList>
    </div>
  </Breadcrumb>
</template>
