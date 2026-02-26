<script setup lang="ts">
import { useMenuData } from '~/composables/useMenuData';
import {
  normalizeMenuUrl,
  getMenuLabel,
  getVisibleItems,
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

const visibleItems = computed(() => {
  if (!menu.value?.menuItems) return [];
  return getVisibleItems(menu.value.menuItems);
});

const shouldRender = computed(
  () => !pending.value && !error.value && visibleItems.value.length > 0,
);

function itemUrl(canonicalUrl: string | undefined): string {
  return normalizeMenuUrl(canonicalUrl);
}

function isActive(canonicalUrl: string | undefined): boolean {
  const normalized = normalizeMenuUrl(canonicalUrl);
  return normalized !== '' && route.path === normalized;
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
</script>

<template>
  <nav
    v-if="shouldRender"
    :aria-label="$t('nav.sidebar_navigation')"
    data-testid="sidebar-nav"
  >
    <!-- Desktop: sticky vertical nav, hidden on mobile -->
    <ul class="sticky top-4 hidden space-y-1 md:block">
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
                :to="itemUrl(child.canonicalUrl)"
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
            :to="itemUrl(item.canonicalUrl)"
            :aria-current="isActive(item.canonicalUrl) ? 'page' : undefined"
            class="block rounded-md py-2 ps-3 text-sm transition-colors"
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

    <!-- Mobile: collapsible accordion, hidden on desktop -->
    <div class="md:hidden">
      <Accordion type="single" collapsible>
        <AccordionItem value="sidebar-menu">
          <AccordionTrigger class="text-sm font-medium">
            {{ $t('nav.sidebar_navigation') }}
          </AccordionTrigger>
          <AccordionContent>
            <ul class="space-y-1 py-2">
              <li
                v-for="item in visibleItems"
                :key="item.id ?? getMenuLabel(item)"
              >
                <template v-if="visibleChildren(item.children).length > 0">
                  <span
                    class="text-foreground block py-2 ps-3 text-sm font-semibold"
                  >
                    {{ getMenuLabel(item) }}
                  </span>
                  <ul class="space-y-0.5 ps-4">
                    <li
                      v-for="child in visibleChildren(item.children)"
                      :key="child.id ?? getMenuLabel(child)"
                    >
                      <NuxtLink
                        :to="itemUrl(child.canonicalUrl)"
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
                    :to="itemUrl(item.canonicalUrl)"
                    :aria-current="
                      isActive(item.canonicalUrl) ? 'page' : undefined
                    "
                    class="block rounded-md py-2 ps-3 text-sm transition-colors"
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
