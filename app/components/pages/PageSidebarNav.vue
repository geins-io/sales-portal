<script setup lang="ts">
import { useMenuData } from '~/composables/useMenuData';
import {
  normalizeMenuUrl,
  stripGeinsPrefix,
  getMenuLabel,
  getVisibleItems,
  addCategoryPrefix,
} from '#shared/utils/menu';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '~/components/ui/accordion';

const props = defineProps<{
  menuLocationId: string;
}>();

const route = useRoute();
const { menu, pending, error } = useMenuData(props.menuLocationId);
const { localePath } = useLocaleMarket();

const visibleItems = computed(() => {
  if (!menu.value?.menuItems) return [];
  return getVisibleItems(menu.value.menuItems);
});

const shouldRender = computed(
  () => !pending.value && !error.value && visibleItems.value.length > 0,
);

function itemUrl(
  canonicalUrl: string | undefined,
  item?: Parameters<typeof addCategoryPrefix>[1],
): string {
  let normalized = normalizeMenuUrl(canonicalUrl);
  if (normalized && item) normalized = addCategoryPrefix(normalized, item);
  return normalized ? localePath(normalized) : '';
}

function isActive(canonicalUrl: string | undefined): boolean {
  const normalized = normalizeMenuUrl(canonicalUrl);
  if (normalized === '') return false;
  // route.path carries the /{market}/{locale} prefix; strip it the same way
  // normalizeMenuUrl strips it from the menu URL so the two compare like-for-like.
  const current = stripGeinsPrefix(route.path);
  if (current === normalized) return true;
  // Match child pages (e.g. /about/team matches /about) but not root '/'
  return normalized !== '/' && current.startsWith(normalized + '/');
}

function visibleChildren(
  children:
    | Array<{
        id?: string;
        label?: string;
        title?: string;
        canonicalUrl?: string;
        order?: number;
        hidden?: boolean;
      }>
    | undefined,
) {
  return getVisibleItems(children as Parameters<typeof getVisibleItems>[0]);
}

/**
 * Label of the page that matches the current route, used as the value shown
 * in the collapsed mobile control. Returns null when no item matches so the
 * template can fall back to the navigation heading as a placeholder.
 */
const activeLabel = computed<string | null>(() => {
  for (const item of visibleItems.value) {
    const children = visibleChildren(item.children);
    if (children.length > 0) {
      const activeChild = children.find((child) =>
        isActive(child.canonicalUrl),
      );
      if (activeChild) return getMenuLabel(activeChild);
    } else if (isActive(item.canonicalUrl)) {
      return getMenuLabel(item);
    }
  }
  return null;
});
</script>

<template>
  <nav
    v-if="shouldRender"
    :aria-label="$t('nav.sidebar_navigation')"
    data-testid="sidebar-nav"
  >
    <!-- Desktop: sticky vertical nav, hidden on mobile -->
    <ul
      class="border-border divide-border sticky top-4 hidden divide-y overflow-hidden rounded-lg border bg-white md:block"
    >
      <li v-for="item in visibleItems" :key="item.id ?? getMenuLabel(item)">
        <template v-if="visibleChildren(item.children).length > 0">
          <span class="text-foreground block py-2 ps-3 text-sm font-semibold">
            {{ getMenuLabel(item) }}
          </span>
          <ul class="space-y-0.5 ps-4">
            <li
              v-for="child in visibleChildren(item.children)"
              :key="child.id ?? getMenuLabel(child)"
            >
              <NuxtLink
                :to="itemUrl(child.canonicalUrl, child)"
                :aria-current="
                  isActive(child.canonicalUrl) ? 'page' : undefined
                "
                class="block rounded-md py-1.5 ps-3 text-sm transition-colors"
                :class="
                  isActive(child.canonicalUrl)
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                "
              >
                {{ getMenuLabel(child) }}
              </NuxtLink>
            </li>
          </ul>
        </template>
        <template v-else>
          <NuxtLink
            :to="itemUrl(item.canonicalUrl, item)"
            :aria-current="isActive(item.canonicalUrl) ? 'page' : undefined"
            class="block p-[15px] text-sm transition-colors"
            :class="
              isActive(item.canonicalUrl)
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            "
          >
            {{ getMenuLabel(item) }}
          </NuxtLink>
        </template>
      </li>
    </ul>

    <!-- Mobile: select-style disclosure, hidden on desktop -->
    <div class="md:hidden">
      <p
        class="text-muted-foreground mb-2 text-sm font-medium"
        data-testid="sidebar-nav-heading"
      >
        {{ $t('nav.sidebar_navigation') }}
      </p>
      <Accordion type="single" collapsible>
        <AccordionItem value="sidebar-menu" class="border-b-0">
          <AccordionTrigger
            class="border-border text-foreground items-center rounded-lg border bg-white px-4 py-3 font-normal hover:no-underline"
            data-testid="sidebar-nav-trigger"
          >
            {{ activeLabel ?? $t('nav.sidebar_navigation') }}
          </AccordionTrigger>
          <AccordionContent class="pb-0">
            <ul
              class="border-border divide-border mt-2 divide-y overflow-hidden rounded-lg border bg-white"
            >
              <li
                v-for="item in visibleItems"
                :key="item.id ?? getMenuLabel(item)"
              >
                <template v-if="visibleChildren(item.children).length > 0">
                  <span
                    class="text-foreground block px-4 py-3 text-sm font-semibold"
                  >
                    {{ getMenuLabel(item) }}
                  </span>
                  <ul class="divide-border divide-y border-t">
                    <li
                      v-for="child in visibleChildren(item.children)"
                      :key="child.id ?? getMenuLabel(child)"
                    >
                      <NuxtLink
                        :to="itemUrl(child.canonicalUrl, child)"
                        :aria-current="
                          isActive(child.canonicalUrl) ? 'page' : undefined
                        "
                        class="block py-3 ps-8 pe-4 text-sm transition-colors"
                        :class="
                          isActive(child.canonicalUrl)
                            ? 'bg-accent text-accent-foreground font-medium'
                            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                        "
                      >
                        {{ getMenuLabel(child) }}
                      </NuxtLink>
                    </li>
                  </ul>
                </template>
                <template v-else>
                  <NuxtLink
                    :to="itemUrl(item.canonicalUrl, item)"
                    :aria-current="
                      isActive(item.canonicalUrl) ? 'page' : undefined
                    "
                    class="block px-4 py-3 text-sm transition-colors"
                    :class="
                      isActive(item.canonicalUrl)
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                    "
                  >
                    {{ getMenuLabel(item) }}
                  </NuxtLink>
                </template>
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  </nav>
</template>
