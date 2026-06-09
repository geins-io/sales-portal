<script setup lang="ts">
import { CMS_MENUS } from '#shared/constants/cms';
import {
  normalizeMenuUrl,
  getMenuLabel,
  getVisibleItems,
  isExternalUrl,
} from '#shared/utils/menu';
import { isSafeInternalPath } from '#shared/utils/redirect';
import type { MenuItemType } from '#shared/types/cms';

const props = defineProps<{
  /** Route path of the currently active page */
  activePath: string;
}>();

const { t } = useI18n();
const route = useRoute();
const { localePath } = useLocaleMarket();

const { menu, error, isConfigured } = useCmsMenuData(CMS_MENUS.SIDEBAR_FALLBACK);
const currentHost = computed(() => useRequestURL().host);

const menuItems = computed(() => getVisibleItems(menu.value?.menuItems));

const showCmsMenu = computed(
  () => isConfigured.value && !error.value && menuItems.value.length > 0,
);

const fallbackLinks = computed(() => [
  { label: t('layout.about_us'), to: localePath('/about') },
  { label: t('layout.contact'), to: localePath('/contact') },
  { label: t('layout.apply_for_account'), to: localePath('/apply-for-account') },
  { label: t('layout.terms'), to: localePath('/terms') },
]);

function itemIsExternal(item: MenuItemType): boolean {
  const url = normalizeMenuUrl(item.canonicalUrl, currentHost.value);
  return isExternalUrl(url, currentHost.value) || !!item.targetBlank;
}

function itemTo(item: MenuItemType): string {
  const url = normalizeMenuUrl(item.canonicalUrl, currentHost.value);
  return itemIsExternal(item)
    ? (url || '/')
    : localePath(isSafeInternalPath(url) ? url : '/');
}

function isActive(to: string): boolean {
  return route.path === to || to.endsWith(props.activePath);
}
</script>

<template>
  <nav
    class="bg-muted sticky top-4 hidden rounded-lg p-4 md:block"
    :aria-label="t('nav.sidebar_navigation')"
    data-testid="info-page-sidebar"
  >
    <ul class="space-y-1">
      <!-- CMS menu branch -->
      <template v-if="showCmsMenu">
        <li v-for="item in menuItems" :key="item.id">
          <NuxtLink
            v-if="!itemIsExternal(item)"
            :to="itemTo(item)"
            :aria-current="isActive(itemTo(item)) ? 'page' : undefined"
            class="block rounded-md py-2 ps-3 text-sm transition-colors"
            :class="
              isActive(itemTo(item))
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            "
          >
            {{ getMenuLabel(item) }}
          </NuxtLink>
          <a
            v-else
            :href="itemTo(item)"
            target="_blank"
            rel="noopener"
            class="text-muted-foreground hover:bg-accent/50 hover:text-foreground block rounded-md py-2 ps-3 text-sm transition-colors"
          >
            {{ getMenuLabel(item) }}
          </a>
        </li>
      </template>

      <!-- Fallback branch -->
      <template v-else>
        <li v-for="link in fallbackLinks" :key="link.to">
          <NuxtLink
            :to="link.to"
            :aria-current="isActive(link.to) ? 'page' : undefined"
            class="block rounded-md py-2 ps-3 text-sm transition-colors"
            :class="
              isActive(link.to)
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            "
          >
            {{ link.label }}
          </NuxtLink>
        </li>
      </template>
    </ul>
  </nav>
</template>
