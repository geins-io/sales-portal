<script setup lang="ts">
import { computed } from 'vue';
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

function linkTag(item: MenuItemType) {
  return isExternal(item) ? 'a' : resolveComponent('NuxtLink');
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
    class="bg-muted relative hidden h-16 items-center border-b lg:flex"
    :aria-label="$t('layout.main_navigation')"
  >
    <div class="mx-auto w-full max-w-7xl px-4 lg:px-8">
      <NavigationMenu
        :viewport="false"
        class="static max-w-none justify-start [&>div]:!static"
      >
        <NavigationMenuList class="gap-2">
          <NavigationMenuItem
            v-for="item in visibleItems"
            :key="item.id"
            :class="visibleChildren(item).length ? '!static' : ''"
          >
            <!-- Item with children: trigger + mega menu -->
            <template v-if="visibleChildren(item).length">
              <NavigationMenuTrigger>
                {{ getMenuLabel(item) }}
              </NavigationMenuTrigger>
              <NavigationMenuContent
                class="!absolute !top-full !left-0 !mt-0 !w-screen !max-w-none !rounded-none !border-x-0 !border-t-0"
              >
                <div class="mx-auto max-w-7xl px-4 py-6 lg:px-8">
                  <!-- "View all" link for parent category -->
                  <NavigationMenuLink as-child>
                    <component
                      :is="linkTag(item)"
                      v-bind="linkAttrs(item)"
                      class="text-primary hover:text-primary/80 mb-3 inline-block text-sm font-semibold"
                    >
                      {{
                        $t('common.view_all_in', { name: getMenuLabel(item) })
                      }}
                    </component>
                  </NavigationMenuLink>
                  <div
                    class="grid gap-x-8 gap-y-1"
                    :style="{
                      gridTemplateColumns: `repeat(${Math.min(visibleChildren(item).length, 4)}, minmax(0, 1fr))`,
                    }"
                  >
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
                </div>
              </NavigationMenuContent>
            </template>

            <!-- Item without children: plain link -->
            <template v-else>
              <NavigationMenuLink as-child>
                <component
                  :is="linkTag(item)"
                  v-bind="linkAttrs(item)"
                  class="hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground inline-flex h-9 items-center rounded-md px-4 py-2 text-sm font-medium transition-colors"
                >
                  {{ getMenuLabel(item) }}
                </component>
              </NavigationMenuLink>
            </template>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  </nav>
</template>
