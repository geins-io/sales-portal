<script setup lang="ts">
const props = defineProps<{
  /** Route path of the currently active page */
  activePath: string;
}>();

const { t } = useI18n();
const route = useRoute();

const links = computed(() => [
  { label: t('info_pages.about_us'), to: '/about' },
  { label: t('info_pages.contact'), to: '/contact' },
  { label: t('info_pages.apply_for_account'), to: '/apply-for-account' },
  { label: t('info_pages.terms'), to: '/terms' },
]);

function isActive(to: string): boolean {
  return route.path === to || props.activePath === to;
}
</script>

<template>
  <nav
    class="sticky top-4 hidden md:block"
    :aria-label="t('nav.sidebar_navigation')"
    data-testid="info-page-sidebar"
  >
    <ul class="space-y-1">
      <li v-for="link in links" :key="link.to">
        <NuxtLink
          :to="link.to"
          :aria-current="isActive(link.to) ? 'page' : undefined"
          class="block rounded-md py-2 ps-3 text-sm transition-colors"
          :class="
            isActive(link.to)
              ? 'bg-accent text-accent-foreground font-medium'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
          "
        >
          {{ link.label }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
