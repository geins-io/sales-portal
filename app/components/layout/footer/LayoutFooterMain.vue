<script setup lang="ts">
import { computed } from 'vue';
import type { FunctionalComponent } from 'vue';
import { NuxtLink } from '#components';
import {
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
  Youtube,
} from 'lucide-vue-next';
import type { MenuItemType } from '#shared/types/cms';
import { CMS_MENUS } from '#shared/constants/cms';
import {
  normalizeMenuUrl,
  getMenuLabel,
  getVisibleItems,
  isExternalUrl,
  addCategoryPrefix,
} from '#shared/utils/menu';

// Resolves the menuLocationId from `tenant.cms.menus[FOOTER]`.
// When unconfigured, the footer link block is hidden but the layout's
// surrounding branding / copyright remain.
const { menu } = useCmsMenuData(CMS_MENUS.FOOTER);
const { contact } = useTenant();
const currentHost = computed(() => useRequestURL().host);
const { localePath } = useLocaleMarket();

const SOCIAL_ICONS = {
  facebook: Facebook,
  instagram: Instagram,
  twitter: Twitter,
  linkedin: Linkedin,
  youtube: Youtube,
} satisfies Record<string, FunctionalComponent>;

type SocialKey = keyof typeof SOCIAL_ICONS;

const SOCIAL_KEYS = Object.keys(SOCIAL_ICONS) as SocialKey[];

const socialEntries = computed(() => {
  const social = contact.value?.social;
  if (!social)
    return [] as Array<{
      key: SocialKey;
      url: string;
      icon: FunctionalComponent;
    }>;
  return SOCIAL_KEYS.map((key) => ({
    key,
    url: social[key] ?? '',
    icon: SOCIAL_ICONS[key],
  })).filter((entry) => entry.url.length > 0);
});

const hasSocial = computed(() => socialEntries.value.length > 0);

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
  <div
    v-if="visibleItems.length || hasSocial"
    data-slot="footer-main"
    class="px-6 py-8 lg:px-6 lg:py-10"
  >
    <div class="mx-auto max-w-7xl">
      <h3 v-if="menu?.title" class="mb-4 text-sm font-bold">
        {{ menu.title }}
      </h3>
      <div
        v-if="visibleItems.length"
        class="grid grid-cols-2 gap-8 md:grid-cols-4"
      >
        <template v-for="item in visibleItems" :key="item.id">
          <!-- Item with children: render as a column -->
          <div v-if="visibleChildren(item).length">
            <h4 class="mb-3 text-sm font-semibold">
              {{ getMenuLabel(item) }}
            </h4>
            <ul class="flex flex-col gap-2">
              <li v-for="child in visibleChildren(item)" :key="child.id">
                <component
                  :is="linkTag(child)"
                  v-bind="linkAttrs(child)"
                  class="text-footer-text/70 hover:text-footer-text text-sm transition-colors"
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
            class="text-footer-text/70 hover:text-footer-text text-sm transition-colors"
          >
            {{ getMenuLabel(item) }}
          </component>
        </template>
      </div>

      <!-- Social row: rendered only when at least one social URL is set -->
      <div
        v-if="hasSocial"
        data-slot="footer-social"
        :class="visibleItems.length ? 'mt-8 flex gap-4' : 'flex gap-4'"
      >
        <a
          v-for="entry in socialEntries"
          :key="entry.key"
          :href="entry.url"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="entry.key"
          class="text-footer-text/70 hover:text-footer-text transition-colors"
        >
          <component :is="entry.icon" class="size-5" />
        </a>
      </div>
    </div>
  </div>
</template>
