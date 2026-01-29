<script setup lang="ts">
interface FooterColumn {
  title: string;
  links: { label: string; href: string }[];
}

// TODO: Wire to CMS/tenant config
const columns: FooterColumn[] = [
  {
    title: 'Company',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Careers', href: '/careers' },
      { label: 'Partners', href: '/partners' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Guides', href: '/guides' },
      { label: 'Tutorials', href: '/tutorials' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Downloads', href: '/downloads' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Your Account', href: '/account' },
      { label: 'Settings', href: '/settings' },
      { label: 'Accessibility', href: '/accessibility' },
      { label: 'Terms', href: '/terms' },
    ],
  },
  {
    title: 'Help & Feedback',
    links: [
      { label: 'Contact Support', href: '/support' },
      { label: 'Get In Touch', href: '/contact' },
      { label: 'Help Articles', href: '/help' },
      { label: 'Feedback Form', href: '/feedback' },
    ],
  },
  {
    title: 'Social',
    links: [
      { label: 'Facebook', href: 'https://facebook.com' },
      { label: 'Linkedin', href: 'https://linkedin.com' },
      { label: 'Instagram', href: 'https://instagram.com' },
      { label: 'X', href: 'https://x.com' },
    ],
  },
];
</script>

<template>
  <div class="flex w-full gap-6">
    <div
      v-for="column in columns"
      :key="column.title"
      class="flex flex-1 flex-col gap-4"
    >
      <h3 class="text-foreground text-base font-medium">{{ column.title }}</h3>
      <div class="text-muted-foreground flex flex-col gap-3 text-sm">
        <NuxtLink
          v-for="link in column.links"
          :key="link.label"
          :to="link.href"
          class="hover:text-foreground"
        >
          {{ link.label }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
