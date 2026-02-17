<script setup lang="ts">
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

const appStore = useAppStore();
const authStore = useAuthStore();
const route = useRoute();

// Close on route change
watch(
  () => route.fullPath,
  () => appStore.setSidebarOpen(false),
);

// Same static placeholder data as LayoutHeaderNav
const menuItems = [
  {
    id: '1',
    label: 'Product category',
    children: [
      { id: '1-1', label: 'Sub category', href: '/category/sub-1' },
      { id: '1-2', label: 'Sub category', href: '/category/sub-2' },
      { id: '1-3', label: 'Sub category', href: '/category/sub-3' },
      { id: '1-4', label: 'Sub category', href: '/category/sub-4' },
    ],
  },
  {
    id: '2',
    label: 'Product category',
    children: [
      { id: '2-1', label: 'Sub category', href: '/category/sub-5' },
      { id: '2-2', label: 'Sub category', href: '/category/sub-6' },
    ],
  },
  {
    id: '3',
    label: 'Product category',
    children: [
      { id: '3-1', label: 'Sub category', href: '/category/sub-7' },
      { id: '3-2', label: 'Sub category', href: '/category/sub-8' },
    ],
  },
  { id: '4', label: 'Product category', href: '/category/4' },
  { id: '5', label: 'Product category', href: '/category/5' },
];

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
          <Accordion type="multiple" class="w-full">
            <template v-for="item in menuItems" :key="item.id">
              <AccordionItem
                v-if="item.children?.length"
                :value="item.id"
                class="border-b"
              >
                <AccordionTrigger
                  class="flex w-full items-center justify-between py-3 text-sm font-medium"
                >
                  {{ item.label }}
                </AccordionTrigger>
                <AccordionContent class="pb-3">
                  <NuxtLink
                    v-for="child in item.children"
                    :key="child.id"
                    :to="child.href"
                    class="text-muted-foreground hover:text-foreground block py-1.5 pl-4 text-sm"
                  >
                    {{ child.label }}
                  </NuxtLink>
                </AccordionContent>
              </AccordionItem>
              <NuxtLink
                v-else
                :to="item.href ?? '/'"
                class="block border-b py-3 text-sm font-medium"
              >
                {{ item.label }}
              </NuxtLink>
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
