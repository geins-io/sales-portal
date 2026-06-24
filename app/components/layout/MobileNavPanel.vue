<script setup lang="ts">
import { computed } from 'vue';
import { NuxtLink } from '#components';
import { LogOut, User } from 'lucide-vue-next';
import { useAppStore } from '~/stores/app';
import { useAuthStore } from '~/stores/auth';
import { Sheet, SheetContent } from '~/components/ui/sheet';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '~/components/ui/accordion';
import type { MenuItemType } from '#shared/types/cms';
import { CMS_MENUS } from '#shared/constants/cms';
import {
  normalizeMenuUrl,
  getMenuLabel,
  getVisibleItems,
  isExternalUrl,
  addCategoryPrefix,
} from '#shared/utils/menu';

const appStore = useAppStore();
const authStore = useAuthStore();
const route = useRoute();

// Same source as the header nav — falls back to "no items, drawer shows
// only account + auth links" when the tenant hasn't configured.
const { menu } = useCmsMenuData(CMS_MENUS.MOBILE_DRAWER);
const currentHost = computed(() => useRequestURL().host);
const { localePath } = useLocaleMarket();
const { logout } = useLogout();

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

// Close on route change
watch(
  () => route.fullPath,
  () => appStore.setSidebarOpen(false),
);

const isOpen = computed({
  get: () => appStore.sidebarOpen,
  set: (val: boolean) => appStore.setSidebarOpen(val),
});
</script>

<template>
  <div data-slot="mobile-nav" data-testid="mobile-nav-panel">
    <Sheet v-model:open="isOpen">
      <SheetContent side="left" class="flex w-80 flex-col p-0">
        <!-- Header -->
        <div class="flex items-center justify-between border-b px-4 py-3">
          <BrandLogo height="h-6" :linked="false" />
        </div>

        <!-- Navigation -->
        <div class="flex-1 overflow-y-auto px-4 py-4">
          <Accordion v-if="visibleItems.length" type="multiple" class="w-full">
            <template v-for="item in visibleItems" :key="item.id">
              <!-- Item with children: accordion -->
              <AccordionItem
                v-if="visibleChildren(item).length"
                :value="item.id ?? ''"
                class="border-b"
              >
                <AccordionTrigger
                  class="flex w-full items-center justify-between py-5 text-sm font-medium"
                >
                  {{ getMenuLabel(item) }}
                </AccordionTrigger>
                <!--
                  border-t draws the divider between the trigger and the first
                  sub-item; divide-y draws one between each sub-item. No
                  trailing border on the last child, so the AccordionItem's own
                  border-b (the divider to the next first-level item) stays a
                  single line rather than doubling up under the last sub-item.
                -->
                <AccordionContent class="divide-y border-t pb-3">
                  <template
                    v-for="child in visibleChildren(item)"
                    :key="child.id"
                  >
                    <!-- Child with grandchildren -->
                    <template v-if="visibleChildren(child).length">
                      <span
                        class="text-muted-foreground block py-3 pl-4 text-sm font-medium"
                      >
                        {{ getMenuLabel(child) }}
                      </span>
                      <component
                        :is="linkTag(grandchild)"
                        v-for="grandchild in visibleChildren(child)"
                        :key="grandchild.id"
                        v-bind="linkAttrs(grandchild)"
                        class="text-muted-foreground hover:text-foreground block py-3 pl-8 text-sm"
                      >
                        {{ getMenuLabel(grandchild) }}
                      </component>
                    </template>
                    <!-- Child without grandchildren -->
                    <component
                      :is="linkTag(child)"
                      v-else
                      v-bind="linkAttrs(child)"
                      class="text-muted-foreground hover:text-foreground block py-3 pl-4 text-sm"
                    >
                      {{ getMenuLabel(child) }}
                    </component>
                  </template>
                </AccordionContent>
              </AccordionItem>

              <!-- Item without children: direct link -->
              <component
                :is="linkTag(item)"
                v-else
                v-bind="linkAttrs(item)"
                class="block border-b py-5 text-sm font-medium"
              >
                {{ getMenuLabel(item) }}
              </component>
            </template>
          </Accordion>
        </div>

        <!--
          Footer holds only the auth action(s): lang + market live in the
          topbar (the teal strip), which stays visible on mobile, so they are
          intentionally not duplicated here. Each action is a full-width,
          centered CTA with a larger touch target so login, portal and logout
          read as consistent buttons.
        -->
        <div class="space-y-3 border-t px-4 py-4">
          <button
            v-if="!authStore.isAuthenticated"
            type="button"
            class="flex w-full items-center justify-center gap-2 py-3 text-base font-medium"
            data-testid="mobile-nav-login"
            @click="
              () => {
                appStore.setSidebarOpen(false);
                authStore.openSheet();
              }
            "
          >
            <User class="size-5" />
            {{ $t('auth.login') }}
          </button>
          <template v-else>
            <NuxtLink
              :to="localePath('/portal')"
              class="flex w-full items-center justify-center gap-2 py-3 text-base font-medium"
              data-testid="mobile-nav-portal"
              @click="appStore.setSidebarOpen(false)"
            >
              <User class="size-5" />
              {{ $t('layout.customer_portal') }}
            </NuxtLink>
            <button
              type="button"
              class="flex w-full items-center justify-center gap-2 py-3 text-base font-medium"
              data-testid="mobile-nav-logout"
              @click="
                () => {
                  appStore.setSidebarOpen(false);
                  logout();
                }
              "
            >
              <LogOut class="size-5" />
              {{ $t('auth.logout') }}
            </button>
          </template>
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
