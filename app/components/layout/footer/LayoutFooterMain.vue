<script setup lang="ts">
import { computed } from 'vue';
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

// Call useCmsMenuData once per key. Composables cannot be called in a loop.
const { menu: footerMenu } = useCmsMenuData(CMS_MENUS.FOOTER);
const { menu: footerMenu2 } = useCmsMenuData(CMS_MENUS.FOOTER_2);
const { menu: footerMenu3 } = useCmsMenuData(CMS_MENUS.FOOTER_3);

const { contact } = useTenant();
const { localePath, currentLocale } = useLocaleMarket();
const currentHost = computed(() => useRequestURL().host);

// Build a flat column entry for a menu if it has visible items.
function toColumn(menu: typeof footerMenu.value, id: string) {
  const items = getVisibleItems(menu?.menuItems);
  if (items.length === 0) return null;
  return { id, title: menu?.title || '', items };
}

const menuColumns = computed(() => {
  return [
    toColumn(footerMenu.value, 'footer'),
    toColumn(footerMenu2.value, 'footer_2'),
    toColumn(footerMenu3.value, 'footer_3'),
  ].filter((col): col is NonNullable<typeof col> => col !== null);
});

// Contact computeds
const hasContact = computed(
  () => !!(contact.value?.email || contact.value?.phone),
);

const telHref = computed(() => {
  const phone = contact.value?.phone;
  if (!phone) return '';
  return `tel:${phone.replace(/\s+/g, '')}`;
});

// Address computeds
const address = computed(() => contact.value?.address);

const hasAddress = computed(() => {
  const a = address.value;
  if (!a) return false;
  return !!(a.street || a.city || a.postalCode || a.country);
});

const cityLine = computed(() => {
  const a = address.value;
  if (!a) return '';
  return [a.postalCode, a.city].filter(Boolean).join(' ');
});

function regionName(code?: string | null): string {
  if (!code) return '';
  try {
    const name = new Intl.DisplayNames([currentLocale.value], {
      type: 'region',
    }).of(code);
    return name || code;
  } catch {
    return code;
  }
}

const countryName = computed(() => regionName(address.value?.country));

// Render guard: show the wrapper only when there is something to display
const shouldRender = computed(
  () => menuColumns.value.length > 0 || hasContact.value || hasAddress.value,
);

// Reuse the existing link helpers verbatim, operating on flat top-level items.
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
    v-if="shouldRender"
    data-slot="footer-main"
    class="px-6 py-8 lg:px-6 lg:py-10"
  >
    <div class="mx-auto max-w-7xl">
      <div class="grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-5">
        <!-- Contact column -->
        <div v-if="hasContact">
          <h3 class="mb-4 text-sm font-bold">
            {{ $t('layout.contact') }}
          </h3>
          <ul class="flex flex-col gap-2">
            <li v-if="contact?.email">
              <span class="text-footer-text/70 block text-sm"
                >{{ $t('layout.email') }}:</span
              >
              <a
                :href="`mailto:${contact.email}`"
                class="text-footer-text/70 hover:text-footer-text block text-sm break-words transition-colors"
                >{{ contact.email }}</a
              >
            </li>
            <li v-if="contact?.phone">
              <span class="text-footer-text/70 text-sm"
                >{{ $t('layout.phone') }}:</span
              >
              <a
                :href="telHref"
                class="text-footer-text/70 hover:text-footer-text ml-1 text-sm transition-colors"
                >{{ contact.phone }}</a
              >
            </li>
          </ul>
        </div>

        <!-- Address column -->
        <div v-if="hasAddress">
          <h3 class="mb-4 text-sm font-bold">
            {{ $t('layout.address') }}
          </h3>
          <div class="text-footer-text/70 flex flex-col gap-1 text-sm">
            <p v-if="address?.street">{{ address.street }}</p>
            <p v-if="cityLine">{{ cityLine }}</p>
            <p v-if="countryName">{{ countryName }}</p>
          </div>
        </div>

        <!-- Menu columns (flat, one per configured footer menu) -->
        <div v-for="col in menuColumns" :key="col.id">
          <h3 v-if="col.title" class="mb-4 text-sm font-bold">
            {{ col.title }}
          </h3>
          <ul class="flex flex-col gap-2">
            <li v-for="item in col.items" :key="item.id">
              <component
                :is="linkTag(item)"
                v-bind="linkAttrs(item)"
                class="text-footer-text/70 hover:text-footer-text text-sm transition-colors"
              >
                {{ getMenuLabel(item) }}
              </component>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
