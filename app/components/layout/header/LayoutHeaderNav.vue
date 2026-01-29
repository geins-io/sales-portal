<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next';
import type { HeaderNavLink } from '#shared/types/layout';

interface Props {
  navLinks?: HeaderNavLink[];
}

// TODO: Wire to CMS/tenant config
const defaultNavLinks: HeaderNavLink[] = [
  { label: 'Product category', href: '/category/1', hasDropdown: true },
  { label: 'Product category', href: '/category/2', hasDropdown: true },
  { label: 'Product category', href: '/category/3', hasDropdown: true },
  { label: 'Product category', href: '/category/4', hasDropdown: true },
  { label: 'Product category', href: '/category/5', hasDropdown: true },
];

const props = withDefaults(defineProps<Props>(), {
  navLinks: () => [],
});

const links = computed(() =>
  props.navLinks.length > 0 ? props.navLinks : defaultNavLinks,
);
</script>

<template>
  <nav class="bg-muted flex h-16 w-full items-center justify-center px-6">
    <div class="flex w-full max-w-[1280px] items-center justify-center">
      <div class="flex items-center gap-2">
        <button
          v-for="(link, index) in links"
          :key="index"
          class="text-foreground hover:bg-accent flex h-10 items-center gap-2 rounded-md bg-transparent px-3 py-1 text-sm font-medium"
        >
          <span>{{ link.label }}</span>
          <ChevronDown v-if="link.hasDropdown" class="size-4" />
        </button>
      </div>
    </div>
  </nav>
</template>
