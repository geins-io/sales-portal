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

const { menu } = useMenuData(MENU_LOCATION.FOOTER);
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
  <div
    v-if="visibleItems.length"
    data-slot="footer-main"
    class="px-6 py-8 lg:px-8 lg:py-10"
  >
    <div class="mx-auto max-w-7xl">
      <h3 v-if="menu?.title" class="mb-4 text-sm font-bold">
        {{ menu.title }}
      </h3>
      <div class="flex flex-col gap-6">
        <template v-for="item in visibleItems" :key="item.id">
          <!-- Item with children: render as a column group -->
          <div v-if="visibleChildren(item).length">
            <h4 class="mb-2 text-sm font-semibold">
              {{ getMenuLabel(item) }}
            </h4>
            <ul class="flex flex-wrap gap-x-6 gap-y-1">
              <li v-for="child in visibleChildren(item)" :key="child.id">
                <component
                  :is="linkTag(child)"
                  v-bind="linkAttrs(child)"
                  class="text-muted-foreground hover:text-foreground text-sm transition-colors"
                >
                  {{ getMenuLabel(child) }}
                </component>
              </li>
            </ul>
          </div>

          <!-- Item without children: render as a flat link -->
          <component
            :is="linkTag(item)"
            v-else
            v-bind="linkAttrs(item)"
            class="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            {{ getMenuLabel(item) }}
          </component>
        </template>
      </div>
    </div>
  </div>
</template>
