<script setup lang="ts">
import { computed } from 'vue';
import { ChevronDown } from 'lucide-vue-next';
import {
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuRoot,
  NavigationMenuTrigger,
  NavigationMenuViewport,
} from 'reka-ui';
import type { MenuItemType } from '#shared/types/cms';
import { MENU_LOCATION } from '#shared/constants/cms';
import {
  normalizeMenuUrl,
  getMenuLabel,
  getVisibleItems,
  isExternalUrl,
} from '#shared/utils/menu';

const { menu } = useMenuData(MENU_LOCATION.MAIN);
const currentHost = computed(() => useRequestURL().host);

const visibleItems = computed(() => getVisibleItems(menu.value?.menuItems));

function visibleChildren(item: MenuItemType): MenuItemType[] {
  return getVisibleItems(item.children);
}

function isExternal(item: MenuItemType): boolean {
  const url = normalizeMenuUrl(item.canonicalUrl, currentHost.value);
  return isExternalUrl(url, currentHost.value) || !!item.targetBlank;
}

function linkTag(item: MenuItemType): string {
  return isExternal(item) ? 'a' : 'NuxtLink';
}

function linkAttrs(item: MenuItemType): Record<string, string | undefined> {
  const url = normalizeMenuUrl(item.canonicalUrl, currentHost.value);
  const ext = isExternal(item);
  return {
    [ext ? 'href' : 'to']: url || '/',
    target: ext ? '_blank' : undefined,
    rel: ext ? 'noopener' : undefined,
  };
}
</script>

<template>
  <nav
    v-if="visibleItems.length"
    class="bg-muted/50 hidden border-b lg:flex"
    :aria-label="$t('layout.main_navigation')"
  >
    <div class="mx-auto w-full max-w-7xl px-4 lg:px-8">
      <NavigationMenuRoot class="relative flex w-full justify-start">
        <NavigationMenuList class="flex items-center gap-2">
          <NavigationMenuItem v-for="item in visibleItems" :key="item.id">
            <!-- Item with children: trigger + mega menu -->
            <template v-if="visibleChildren(item).length">
              <NavigationMenuTrigger
                class="text-foreground/80 hover:text-foreground data-[state=open]:text-foreground group flex items-center gap-1 bg-transparent px-3 py-3 text-sm font-medium transition-colors"
              >
                {{ getMenuLabel(item) }}
                <ChevronDown
                  class="size-3.5 opacity-60 transition-transform duration-200 group-data-[state=open]:rotate-180"
                />
              </NavigationMenuTrigger>
              <NavigationMenuContent
                class="bg-popover text-popover-foreground absolute top-full left-0 w-full rounded-b-lg border-x border-b p-6 shadow-lg"
              >
                <div class="grid grid-cols-4 gap-6">
                  <NavigationMenuLink
                    v-for="child in visibleChildren(item)"
                    :key="child.id"
                    as-child
                  >
                    <component
                      :is="linkTag(child)"
                      v-bind="linkAttrs(child)"
                      class="hover:text-primary text-sm transition-colors"
                    >
                      {{ getMenuLabel(child) }}
                    </component>
                  </NavigationMenuLink>
                </div>
              </NavigationMenuContent>
            </template>

            <!-- Item without children: direct link -->
            <template v-else>
              <NavigationMenuLink as-child>
                <component
                  :is="linkTag(item)"
                  v-bind="linkAttrs(item)"
                  class="text-foreground/80 hover:text-foreground px-3 py-3 text-sm font-medium transition-colors"
                >
                  {{ getMenuLabel(item) }}
                </component>
              </NavigationMenuLink>
            </template>
          </NavigationMenuItem>
        </NavigationMenuList>

        <div
          class="absolute top-full left-0 flex w-full justify-center perspective-[2000px]"
        >
          <NavigationMenuViewport
            class="data-[state=open]:animate-in data-[state=closed]:animate-out relative mt-0 h-[var(--reka-navigation-menu-viewport-height)] w-full origin-top overflow-hidden transition-all duration-200"
          />
        </div>
      </NavigationMenuRoot>
    </div>
  </nav>
</template>
