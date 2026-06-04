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
} from '#shared/utils/menu';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '~/components/ui/navigation-menu';

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
  let url = normalizeMenuUrl(item.canonicalUrl, currentHost.value);
  const ext = isExternal(item);
  if (!ext) url = addCategoryPrefix(url, item);
  const href = ext ? url || '/' : localePath(url || '/');
  return {
    [ext ? 'href' : 'to']: href,
    target: ext ? '_blank' : undefined,
    rel: ext ? 'noopener' : undefined,
  };
}
</script>

<template>
  <nav
    v-if="visibleItems.length"
    class="bg-nav-bar-background relative hidden h-12 items-center border-b lg:flex"
    :aria-label="$t('layout.main_navigation')"
  >
    <div class="mx-auto w-full max-w-7xl px-4 lg:px-6">
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
                  <NavigationMenuLink as-child>
                    <component
                      :is="linkTag(item)"
                      v-bind="linkAttrs(item)"
                      class="mb-3 inline-block text-sm font-semibold underline-offset-4 hover:bg-transparent hover:underline focus:bg-transparent"
                    >
                      {{
                        $t('common.view_all_in', { name: getMenuLabel(item) })
                      }}
                    </component>
                  </NavigationMenuLink>
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
