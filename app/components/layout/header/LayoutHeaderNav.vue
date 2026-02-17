<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next';
import {
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuRoot,
  NavigationMenuTrigger,
  NavigationMenuViewport,
} from 'reka-ui';

// Static placeholder data — will be replaced by CMS menu API in SAL-55
interface MenuItem {
  id: string;
  label: string;
  href?: string;
  children?: { id: string; label: string; href: string }[];
}

const menuItems: MenuItem[] = [
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
</script>

<template>
  <nav
    class="bg-background hidden border-b lg:flex"
    :aria-label="$t('layout.main_navigation')"
  >
    <div class="mx-auto w-full max-w-7xl px-4 lg:px-8">
      <NavigationMenuRoot class="relative flex w-full justify-start">
        <NavigationMenuList class="flex items-center gap-1">
          <NavigationMenuItem v-for="item in menuItems" :key="item.id">
            <!-- Item with children: trigger + mega menu -->
            <template v-if="item.children?.length">
              <NavigationMenuTrigger
                class="text-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground group flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors"
              >
                {{ item.label }}
                <ChevronDown
                  class="size-4 transition-transform duration-200 group-data-[state=open]:rotate-180"
                />
              </NavigationMenuTrigger>
              <NavigationMenuContent
                class="bg-popover text-popover-foreground absolute top-full left-0 w-full rounded-b-lg border-x border-b p-6 shadow-lg"
              >
                <div class="grid grid-cols-4 gap-6">
                  <NavigationMenuLink
                    v-for="child in item.children"
                    :key="child.id"
                    as-child
                  >
                    <NuxtLink
                      :to="child.href"
                      class="hover:text-primary text-sm transition-colors"
                    >
                      {{ child.label }}
                    </NuxtLink>
                  </NavigationMenuLink>
                </div>
              </NavigationMenuContent>
            </template>

            <!-- Item without children: direct link -->
            <template v-else>
              <NavigationMenuLink as-child>
                <NuxtLink
                  :to="item.href ?? '/'"
                  class="text-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground rounded-md px-3 py-2 text-sm font-medium transition-colors"
                >
                  {{ item.label }}
                </NuxtLink>
              </NavigationMenuLink>
            </template>
          </NavigationMenuItem>
        </NavigationMenuList>

        <NavigationMenuIndicator
          class="bg-primary z-10 flex h-[2px] items-end justify-center overflow-hidden transition-all duration-200"
        />

        <div
          class="absolute top-full left-0 flex w-full justify-center perspective-[2000px]"
        >
          <NavigationMenuViewport
            class="data-[state=open]:animate-in data-[state=closed]:animate-out relative mt-0 h-[var(--reka-navigation-menu-viewport-height)] w-full origin-top overflow-hidden transition-all duration-200"
          />
        </div>
      </NavigationMenuRoot>
    </div>
  </nav>
</template>
