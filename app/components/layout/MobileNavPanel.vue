<script setup lang="ts">
import { computed } from 'vue';
import { User } from 'lucide-vue-next';
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
import { MENU_LOCATION } from '#shared/constants/cms';
import {
  normalizeMenuUrl,
  getMenuLabel,
  getVisibleItems,
  isExternalUrl,
} from '#shared/utils/menu';

const appStore = useAppStore();
const authStore = useAuthStore();
const route = useRoute();

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
  <div data-slot="mobile-nav">
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
                  class="flex w-full items-center justify-between py-3 text-sm font-medium"
                >
                  {{ getMenuLabel(item) }}
                </AccordionTrigger>
                <AccordionContent class="pb-3">
                  <template
                    v-for="child in visibleChildren(item)"
                    :key="child.id"
                  >
                    <!-- Child with grandchildren -->
                    <template v-if="visibleChildren(child).length">
                      <span
                        class="text-muted-foreground block py-1.5 pl-4 text-sm font-medium"
                      >
                        {{ getMenuLabel(child) }}
                      </span>
                      <component
                        :is="linkTag(grandchild)"
                        v-for="grandchild in visibleChildren(child)"
                        :key="grandchild.id"
                        v-bind="linkAttrs(grandchild)"
                        class="text-muted-foreground hover:text-foreground block py-1.5 pl-8 text-sm"
                      >
                        {{ getMenuLabel(grandchild) }}
                      </component>
                    </template>
                    <!-- Child without grandchildren -->
                    <component
                      :is="linkTag(child)"
                      v-else
                      v-bind="linkAttrs(child)"
                      class="text-muted-foreground hover:text-foreground block py-1.5 pl-4 text-sm"
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
                class="block border-b py-3 text-sm font-medium"
              >
                {{ getMenuLabel(item) }}
              </component>
            </template>
          </Accordion>
        </div>

        <!-- Footer -->
        <div class="space-y-3 border-t px-4 py-4">
          <div class="flex items-center gap-3">
            <LocaleSwitcher variant="inline" />
            <MarketSwitcher variant="inline" />
          </div>
          <NuxtLink
            v-if="!authStore.isAuthenticated"
            to="/login"
            class="flex items-center gap-2 text-sm font-medium"
          >
            <User class="size-4" />
            {{ $t('auth.login') }}
          </NuxtLink>
          <NuxtLink
            v-else
            to="/portal"
            class="flex items-center gap-2 text-sm font-medium"
          >
            <User class="size-4" />
            {{ authStore.displayName }}
          </NuxtLink>
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
