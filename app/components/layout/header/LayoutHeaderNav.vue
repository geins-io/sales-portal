<script setup lang="ts">
import { NuxtLink } from '#components';
import type { MenuItemType } from '#shared/types/cms';
import { CMS_MENUS } from '#shared/constants/cms';
import {
  normalizeMenuUrl,
  getMenuLabel,
  getVisibleItems,
  isExternalUrl,
  addCategoryPrefix,
  splitLabelInTwo,
} from '#shared/utils/menu';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '~/components/ui/navigation-menu';
import { useEventListener, usePreferredReducedMotion } from '@vueuse/core';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';

withDefaults(defineProps<{ variant?: 'grey' | 'white' }>(), {
  variant: 'grey',
});

// Resolves the menuLocationId from `tenant.cms.menus[HEADER_MAIN]`.
// Falls back gracefully to "no nav bar shown" when the tenant hasn't
// configured the slot — the header still has the logo + search + cart.
const { menu } = useCmsMenuData(CMS_MENUS.HEADER_MAIN);
const currentHost = computed(() => useRequestURL().host);
const { localePath } = useLocaleMarket();

const visibleItems = computed(() => getVisibleItems(menu.value?.menuItems));

function visibleChildren(item: MenuItemType): MenuItemType[] {
  return getVisibleItems(item.children);
}

function isExternal(item: MenuItemType): boolean {
  const url = normalizeMenuUrl(item.canonicalUrl, currentHost.value);
  return isExternalUrl(url, currentHost.value) || !!item.targetBlank;
}

function linkTag(item: MenuItemType) {
  return isExternal(item) ? 'a' : NuxtLink;
}

function linkAttrs(item: MenuItemType): Record<string, string | undefined> {
  let url = normalizeMenuUrl(item.canonicalUrl, currentHost.value, item.type);
  const ext = isExternal(item);
  if (!ext) url = addCategoryPrefix(url, item);
  const href = ext ? url || '/' : localePath(url || '/');
  return {
    [ext ? 'href' : 'to']: href,
    target: ext ? '_blank' : undefined,
    rel: ext ? 'noopener' : undefined,
  };
}

const bar = useTemplateRef<HTMLElement>('bar');
const list = shallowRef<HTMLElement | null>(null);
const overflowing = ref(false);
const atStart = ref(true);
const atEnd = ref(false);
const reducedMotion = usePreferredReducedMotion();

const PANEL = '[data-slot="navigation-menu-content"]';

// Mouse aids only: keyboard users Tab through the links, which scroll into
// view, and screen readers read every link wherever the bar is scrolled.
const arrowClass =
  'inline-flex size-9 shrink-0 items-center justify-center rounded-md disabled:opacity-40';

function isAtStart(el: HTMLElement) {
  return el.scrollLeft <= 0;
}

// -1 absorbs the sub-pixel scroll width.
function isAtEnd(el: HTMLElement) {
  return el.scrollLeft >= el.scrollWidth - el.clientWidth - 1;
}

function updateEnds() {
  if (!list.value) return;
  atStart.value = isAtStart(list.value);
  atEnd.value = isAtEnd(list.value);
}

// Measured against the bar, not the list: with the arrows shown the list is
// narrower than the room it gets without them, so it would keep them forever.
function updateOverflow() {
  list.value =
    bar.value?.querySelector<HTMLElement>(
      '[data-slot="navigation-menu-list"]',
    ) ?? null;
  if (!list.value || !bar.value) return;
  // The list's padding is room for the focus rings, not content.
  const style = getComputedStyle(list.value);
  const padding =
    (parseFloat(style.paddingLeft) || 0) +
    (parseFloat(style.paddingRight) || 0);
  overflowing.value = list.value.scrollWidth - padding > bar.value.clientWidth;
  updateEnds();
}

// Pages by whole items: the last item fully in view leads the next view (the
// first one ends the previous view), so a click never stops mid-label and keeps
// one item for orientation. If that item is already at the edge, the next one
// past the edge takes its place, so a click always moves.
function page(direction: 1 | -1) {
  const el = list.value;
  if (!el) return;
  const port = el.getBoundingClientRect();
  const items = Array.from(el.children, (item) => item.getBoundingClientRect());
  let left = 0;
  if (direction > 0) {
    const last = items.findLast((r) => r.right <= port.right + 1);
    const lead =
      last && last.left > port.left + 1
        ? last
        : items.find((r) => r.left > port.left + 1);
    if (lead) left = lead.left - port.left;
  } else {
    const first = items.find((r) => r.left >= port.left - 1);
    const tail =
      first && first.right < port.right - 1
        ? first
        : items.findLast((r) => r.right < port.right - 1);
    if (tail) left = tail.right - port.right;
  }
  el.scrollBy({
    left,
    behavior: reducedMotion.value === 'reduce' ? 'auto' : 'smooth',
  });
}

// A mouse wheel only scrolls vertically. At either end, and so whenever the
// items fit, it goes back to the page; the bar never traps it.
function onWheel(event: WheelEvent) {
  const el = list.value;
  if (!el || event.shiftKey) return;
  if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
  if (event.target instanceof Element && event.target.closest(PANEL)) return;
  if (event.deltaY < 0 ? isAtStart(el) : isAtEnd(el)) return;
  event.preventDefault();
  // Firefox can report the wheel in lines rather than pixels.
  el.scrollLeft += event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
}

// Chromium leaves a partly visible focused element where it is.
function keepFocusedInView(event: FocusEvent) {
  const el = list.value;
  const target = event.target;
  if (!el || !(target instanceof HTMLElement) || target.closest(PANEL)) return;
  const port = el.getBoundingClientRect();
  const item = target.getBoundingClientRect();
  if (item.left < port.left) el.scrollLeft -= port.left - item.left;
  else if (item.right > port.right) el.scrollLeft += item.right - port.right;
}

onMounted(() => {
  updateOverflow();
  // Webfonts change the label widths after the first measure.
  if ('fonts' in document) document.fonts.ready.then(updateOverflow);
});
watch(visibleItems, updateOverflow, { flush: 'post' });
useEventListener('resize', updateOverflow, { passive: true });
useEventListener(list, 'scroll', updateEnds, { passive: true });
useEventListener(list, 'focusin', keepFocusedInView);
useEventListener(bar, 'wheel', onWheel, { passive: false });
</script>

<template>
  <nav
    v-if="visibleItems.length"
    class="bg-nav-bar-background relative hidden h-12 items-center border-b lg:flex"
    :aria-label="$t('layout.main_navigation')"
  >
    <div class="mx-auto w-full max-w-7xl px-4 lg:px-6">
      <div ref="bar" class="flex items-center">
        <button
          v-if="overflowing"
          type="button"
          :class="arrowClass"
          data-nav-arrow="back"
          tabindex="-1"
          aria-hidden="true"
          :disabled="atStart"
          @click="page(-1)"
        >
          <ChevronLeft class="size-4" />
        </button>
        <NavigationMenu
          :viewport="false"
          class="static max-w-none min-w-0 flex-1 justify-start [&>div]:!static [&>div]:min-w-0 [&>div]:flex-1"
        >
          <!--
            Scrolls sideways when the items do not fit even with two-line labels.
            It must stay unpositioned: the mega menus are anchored to the <nav>,
            outside it, which keeps them from being clipped or scrolled along.
            The 3px of padding is room for the focus rings the overflow would clip;
            the negative margin keeps the items where they were.
          -->
          <NavigationMenuList
            class="scrollbar-none -mx-[3px] justify-start gap-2 overflow-x-auto overflow-y-hidden px-[3px] py-[3px]"
          >
            <NavigationMenuItem
              v-for="item in visibleItems"
              :key="item.id"
              :class="visibleChildren(item).length ? '!static' : ''"
            >
              <!-- Item with children: trigger + mega menu -->
              <template v-if="visibleChildren(item).length">
                <NavigationMenuTrigger
                  class="bg-transparent underline-offset-4 hover:bg-transparent hover:underline focus:bg-transparent data-[state=open]:bg-transparent data-[state=open]:underline data-[state=open]:hover:bg-transparent data-[state=open]:focus:bg-transparent"
                >
                  {{ getMenuLabel(item) }}
                </NavigationMenuTrigger>
                <NavigationMenuContent
                  class="!absolute !top-full !left-0 !mt-0 !w-screen !max-w-none !rounded-none !border-x-0 !border-t-0"
                >
                  <!--
                  Cap the open mega menu and scroll its contents internally so a
                  category with many submenus never pushes links below the fold
                  (which would scroll the page instead). 500px is the design
                  target; calc(100vh - 11rem) subtracts the sticky header
                  (topbar 40px + main 80px + nav 48px + 8px gap) so the panel
                  stays inside the viewport on short screens too.
                -->
                  <div
                    class="mx-auto max-h-[min(500px,calc(100vh_-_11rem))] max-w-7xl overflow-y-auto px-4 py-6 lg:px-6"
                  >
                    <div class="grid grid-cols-4 gap-x-8 gap-y-4">
                      <div
                        v-for="child in visibleChildren(item)"
                        :key="child.id"
                        class="flex flex-col gap-1"
                      >
                        <NavigationMenuLink as-child>
                          <component
                            :is="linkTag(child)"
                            v-bind="linkAttrs(child)"
                            class="px-3 py-2 text-sm font-medium underline-offset-4 transition-colors hover:bg-transparent hover:underline focus:bg-transparent"
                          >
                            {{ getMenuLabel(child) }}
                          </component>
                        </NavigationMenuLink>
                        <NavigationMenuLink
                          v-for="grandchild in visibleChildren(child)"
                          :key="grandchild.id"
                          as-child
                        >
                          <component
                            :is="linkTag(grandchild)"
                            v-bind="linkAttrs(grandchild)"
                            class="text-muted-foreground hover:text-foreground px-3 py-1 text-sm underline-offset-4 transition-colors hover:bg-transparent hover:underline focus:bg-transparent"
                          >
                            {{ getMenuLabel(grandchild) }}
                          </component>
                        </NavigationMenuLink>
                      </div>
                    </div>
                  </div>
                </NavigationMenuContent>
              </template>

              <!-- Item without children: plain link -->
              <template v-else>
                <NavigationMenuLink
                  as-child
                  class="inline-flex h-9 flex-row items-center rounded-md bg-transparent px-4 py-2 text-sm font-medium underline-offset-4 transition-colors hover:bg-transparent hover:text-inherit hover:underline focus:bg-transparent focus:text-inherit focus:underline"
                >
                  <component :is="linkTag(item)" v-bind="linkAttrs(item)">
                    <!-- One span: loose spans would each be a flex item. -->
                    <span>
                      <template
                        v-for="(line, i) in splitLabelInTwo(getMenuLabel(item))"
                        :key="i"
                      >
                        <template v-if="i">{{ ' ' }}</template>
                        <span class="whitespace-nowrap">{{ line }}</span>
                      </template>
                    </span>
                  </component>
                </NavigationMenuLink>
              </template>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
        <button
          v-if="overflowing"
          type="button"
          :class="arrowClass"
          data-nav-arrow="forward"
          tabindex="-1"
          aria-hidden="true"
          :disabled="atEnd"
          @click="page(1)"
        >
          <ChevronRight class="size-4" />
        </button>
      </div>
    </div>
  </nav>
</template>
