<script setup lang="ts">
const { t } = useI18n();
const { localePath } = useLocaleMarket();
const route = useRoute();

const navItems = [
  {
    key: 'general_settings',
    label: 'portal.org.sidebar.general_settings',
    href: '/portal/organisation',
  },
  {
    key: 'persons',
    label: 'portal.org.sidebar.persons',
    href: '/portal/organisation/persons',
  },
];

function isActive(href: string): boolean {
  const full = localePath(href);
  return route.path === full || route.path === href;
}
</script>

<template>
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-[180px_1fr]">
    <!-- Sub-nav sidebar -->
    <aside data-testid="organisation-sidebar" class="lg:pt-1">
      <nav
        class="flex flex-col gap-1"
        :aria-label="t('portal.org.sidebar_aria')"
      >
        <NuxtLink
          v-for="item in navItems"
          :key="item.key"
          :to="localePath(item.href)"
          :data-testid="`org-sidebar-${item.key}`"
          class="rounded-md px-3 py-2 text-sm font-medium transition-colors"
          :class="
            isActive(item.href)
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          "
          :aria-current="isActive(item.href) ? 'page' : undefined"
        >
          {{ t(item.label) }}
        </NuxtLink>
      </nav>
    </aside>

    <!-- Main content -->
    <div
      data-testid="organisation-main"
      class="border-border rounded-lg border bg-white p-6"
    >
      <slot />
    </div>
  </div>
</template>
