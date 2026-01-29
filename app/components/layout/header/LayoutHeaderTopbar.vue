<script setup lang="ts">
import { Mail, ChevronDown, User } from 'lucide-vue-next';
import type { HeaderAuthState } from '#shared/types/layout';

interface Props {
  authState?: HeaderAuthState;
  environmentLabel?: string;
}

withDefaults(defineProps<Props>(), {
  authState: 'logged-out',
  environmentLabel: 'DEV',
});

// TODO: Wire to CMS/tenant config
const topbarLinks = {
  left: [
    { label: 'Contact us', href: '/contact', icon: Mail },
    { label: 'English', href: '#', hasDropdown: true },
  ],
  right: [
    { label: 'Apply for account', href: '/apply' },
    { label: 'Log in', href: '/login', icon: User },
  ],
};
</script>

<template>
  <div class="bg-primary flex h-12 w-full items-center justify-center px-6">
    <div class="flex w-full max-w-[1280px] items-center justify-between">
      <!-- Left section -->
      <div class="flex items-center gap-4">
        <button
          v-for="link in topbarLinks.left"
          :key="link.label"
          class="text-primary-foreground flex h-9 items-center gap-2 rounded-md px-0 py-2 text-sm hover:opacity-80"
        >
          <component :is="link.icon" v-if="link.icon" class="size-4" />
          <span>{{ link.label }}</span>
          <ChevronDown v-if="link.hasDropdown" class="size-4" />
        </button>
      </div>

      <!-- Center section -->
      <span class="text-primary-foreground text-sm font-medium">
        {{ environmentLabel }}
      </span>

      <!-- Right section -->
      <div class="flex items-center gap-6">
        <NuxtLink
          v-for="link in topbarLinks.right"
          :key="link.label"
          :to="link.href"
          class="text-primary-foreground flex h-9 items-center gap-2 rounded-md px-0 py-2 text-sm hover:opacity-80"
        >
          <component :is="link.icon" v-if="link.icon" class="size-4" />
          <span>{{ link.label }}</span>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
