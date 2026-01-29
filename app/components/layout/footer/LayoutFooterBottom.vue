<script setup lang="ts">
// TODO: Wire to CMS/tenant config
const currentYear = new Date().getFullYear();
const copyrightText = `Copyright © ${currentYear} Your Company. All rights reserved.`;

const legalLinks = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Cookies Settings', href: '/cookies' },
];
</script>

<template>
  <div
    class="text-muted-foreground flex w-full items-center justify-between text-sm"
  >
    <p>{{ copyrightText }}</p>
    <div class="flex items-center gap-8">
      <NuxtLink
        v-for="link in legalLinks"
        :key="link.label"
        :to="link.href"
        class="hover:text-foreground"
      >
        {{ link.label }}
      </NuxtLink>
    </div>
  </div>
</template>
