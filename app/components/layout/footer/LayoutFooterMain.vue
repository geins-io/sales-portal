<script setup lang="ts">
interface FooterLink {
  label: string;
  to?: string;
  href?: string;
  external?: boolean;
}

interface FooterColumn {
  title: string;
  links: FooterLink[];
}

const columns: FooterColumn[] = [
  {
    title: 'layout.company',
    links: [
      { label: 'layout.about_us', to: '/about' },
      { label: 'layout.blog', to: '/blog' },
      { label: 'layout.careers', to: '/careers' },
      { label: 'layout.partners', to: '/partners' },
    ],
  },
  {
    title: 'layout.resources',
    links: [
      { label: 'layout.guides', to: '/guides' },
      { label: 'layout.tutorials', to: '/tutorials' },
      { label: 'layout.faq', to: '/faq' },
      { label: 'layout.downloads', to: '/downloads' },
    ],
  },
  {
    title: 'account.my_account',
    links: [
      { label: 'layout.your_account', to: '/account' },
      { label: 'account.settings', to: '/account/settings' },
    ],
  },
  {
    title: 'layout.help_feedback',
    links: [
      { label: 'layout.contact_support', to: '/support' },
      { label: 'layout.get_in_touch', to: '/contact' },
      { label: 'layout.help_articles', to: '/help' },
      { label: 'layout.feedback_form', to: '/feedback' },
    ],
  },
  {
    title: 'layout.social',
    links: [
      {
        label: 'layout.facebook',
        href: 'https://facebook.com',
        external: true,
      },
      {
        label: 'layout.linkedin',
        href: 'https://linkedin.com',
        external: true,
      },
      {
        label: 'layout.instagram',
        href: 'https://instagram.com',
        external: true,
      },
    ],
  },
];
</script>

<template>
  <div data-slot="footer-main" class="px-6 py-8 lg:px-8 lg:py-10">
    <div
      class="mx-auto grid max-w-7xl grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
    >
      <div v-for="column in columns" :key="column.title">
        <h3 class="mb-3 text-sm font-bold">
          {{ $t(column.title) }}
        </h3>
        <ul class="flex flex-col gap-2">
          <li v-for="link in column.links" :key="link.label">
            <a
              v-if="link.external"
              :href="link.href"
              target="_blank"
              rel="noopener noreferrer"
              class="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              {{ $t(link.label) }}
            </a>
            <NuxtLink
              v-else
              :to="link.to ?? '/'"
              class="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              {{ $t(link.label) }}
            </NuxtLink>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
