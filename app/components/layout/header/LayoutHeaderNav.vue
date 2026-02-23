<script setup lang="ts">
import { computed } from 'vue';
import { ChevronDown } from 'lucide-vue-next';
import type { MenuItemType } from '#shared/types/cms';
import { MENU_LOCATION } from '#shared/constants/cms';
import {
  normalizeMenuUrl,
  getMenuLabel,
  getVisibleItems,
  isExternalUrl,
} from '#shared/utils/menu';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '~/components/ui/navigation-menu';

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
    class="bg-muted hidden h-16 items-center border-b lg:flex"
    :aria-label="$t('layout.main_navigation')"
  >
    <div class="mx-auto w-full max-w-7xl px-4 lg:px-8">
      <NavigationMenu class="max-w-none justify-start">
        <NavigationMenuList class="gap-2">
          <NavigationMenuItem v-for="item in visibleItems" :key="item.id">
            <!-- Item with children: trigger + mega menu -->
            <template v-if="visibleChildren(item).length">
              <NavigationMenuTrigger>
                {{ getMenuLabel(item) }}
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <div class="grid w-[400px] grid-cols-2 gap-1 p-2 md:w-[500px]">
                  <NavigationMenuLink
                    v-for="child in visibleChildren(item)"
                    :key="child.id"
                    as-child
                  >
                    <component
                      :is="linkTag(child)"
                      v-bind="linkAttrs(child)"
                      class="hover:bg-accent hover:text-accent-foreground rounded-sm px-3 py-2 text-sm transition-colors"
                    >
                      {{ getMenuLabel(child) }}
                    </component>
                  </NavigationMenuLink>
                </div>
              </NavigationMenuContent>
            </template>

            <!-- Item without children: link styled as ghost button with chevron -->
            <template v-else>
              <NavigationMenuLink as-child>
                <component
                  :is="linkTag(item)"
                  v-bind="linkAttrs(item)"
                  class="hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground inline-flex h-9 items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors"
                >
                  {{ getMenuLabel(item) }}
                  <ChevronDown class="size-3 opacity-50" />
                </component>
              </NavigationMenuLink>
            </template>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  </nav>
</template>
