<script setup lang="ts">
import type { GeinsUserType } from '@geins/types';
import type { ContentAreaType } from '#shared/types/cms';
import { useAuthStore } from '~/stores/auth';
import { useFavoritesStore } from '~/stores/favorites';

const { t } = useI18n();
const route = useRoute();
const authStore = useAuthStore();
const { canAccess } = useFeatureAccess();
const { hasFeature } = useTenant();
const { localePath, currentLocale, currentMarket } = useLocaleMarket();
const favoritesStore = useFavoritesStore();

const { data: heroArea } = useFetch<ContentAreaType>('/api/cms/area', {
  query: computed(() => ({
    family: 'Portal',
    areaName: 'Hero',
    ...(currentLocale.value ? { locale: currentLocale.value } : {}),
    ...(currentMarket.value ? { market: currentMarket.value } : {}),
  })),
  dedupe: 'defer',
});

const { data: profileData } = useFetch<{ profile: GeinsUserType }>(
  '/api/user/profile',
  { dedupe: 'defer' },
);

const profile = computed(() => profileData.value?.profile);
const welcomeName = computed(
  () => profile.value?.address?.firstName || authStore.displayName || '',
);
const customerNo = computed(
  () => profile.value?.id?.toString() || authStore.user?.memberId || '',
);
const email = computed(
  () => profile.value?.email || authStore.user?.username || '',
);
const orgName = computed(() => profile.value?.address?.company || '');

interface PortalTab {
  key: string;
  label: string;
  to: string;
  icon: string;
  feature?: string;
}

const tabs: PortalTab[] = [
  {
    key: 'overview',
    label: 'portal.tabs.overview',
    to: '/portal',
    icon: 'lucide:layout-dashboard',
  },
  {
    key: 'orders',
    label: 'portal.tabs.orders',
    to: '/portal/orders',
    icon: 'lucide:shopping-bag',
  },
  {
    key: 'quotations',
    label: 'portal.tabs.quotations',
    to: '/portal/quotations',
    icon: 'lucide:file-text',
  },
  {
    key: 'products',
    label: 'portal.tabs.products',
    to: '/portal/products',
    icon: 'lucide:package',
  },
  {
    key: 'lists',
    label: 'portal.tabs.lists',
    to: '/portal/lists',
    icon: 'lucide:list',
  },
  {
    key: 'favorites',
    label: 'portal.tabs.favorites',
    to: '/portal/favorites',
    icon: 'lucide:heart',
    feature: 'wishlist',
  },
  {
    key: 'organisation',
    label: 'portal.tabs.organisation',
    to: '/portal/organisation',
    icon: 'lucide:building-2',
    feature: 'organisation_tab',
  },
];

const visibleTabs = computed(() =>
  tabs.filter((tab) => !tab.feature || canAccess(tab.feature)),
);

function isActiveTab(tab: PortalTab): boolean {
  const prefixedPath = localePath(tab.to);
  if (tab.to === '/portal') {
    return route.path === prefixedPath || route.path === `${prefixedPath}/`;
  }
  // Saved lists tab should highlight on /portal/saved-lists/[id] detail pages too
  if (tab.key === 'lists') {
    const savedListsPath = localePath('/portal/saved-lists');
    return (
      route.path.startsWith(prefixedPath) ||
      route.path.startsWith(savedListsPath)
    );
  }
  return route.path.startsWith(prefixedPath);
}

async function handleLogout() {
  await authStore.logout();
  navigateTo(localePath('/'));
}
</script>

<template>
  <div data-testid="portal-shell">
    <!-- Hero Banner -->
    <CmsWidgetArea
      v-if="heroArea?.containers?.length"
      data-testid="portal-hero"
      :containers="heroArea.containers"
    />
    <div
      v-else
      data-testid="portal-hero"
      class="bg-primary text-primary-foreground py-12 text-center"
    >
      <p class="text-primary-foreground/70 text-xs tracking-wider uppercase">
        CMS Content area
      </p>
      <h1 class="mt-2 text-3xl font-bold">Portal landing page</h1>
      <p class="text-primary-foreground/80 mx-auto mt-2 max-w-md text-sm">
        Follow with one or two sentences that expand on your value proposition
        and focus on key benefits.
      </p>
    </div>

    <!-- Welcome Card -->
    <div class="mx-auto max-w-6xl px-4">
      <div
        data-testid="portal-welcome"
        class="border-border bg-background -mt-6 flex flex-col justify-between gap-4 rounded-lg border p-6 shadow-sm sm:flex-row sm:items-start"
      >
        <!-- Left: User info -->
        <div>
          <h2 class="text-xl font-semibold">
            {{ t('portal.welcome', { name: welcomeName }) }}
          </h2>
          <p class="text-muted-foreground mt-1 text-sm">
            {{ t('portal.customer_no', { id: customerNo, email }) }}
          </p>
          <p v-if="orgName" class="text-muted-foreground text-sm">
            {{ t('portal.organisation', { org: orgName }) }}
          </p>
        </div>

        <!-- Right: Quick links -->
        <div class="flex flex-col gap-2 text-sm">
          <NuxtLink
            v-if="hasFeature('wishlist')"
            :to="localePath('/portal/favorites')"
            class="text-primary hover:text-primary/80 flex items-center gap-2 font-medium"
          >
            <Icon name="lucide:heart" class="size-4" />
            {{ t('portal.quick_links.favorites') }}
            <span
              v-if="favoritesStore.count > 0"
              data-testid="favorites-count"
              class="bg-primary text-primary-foreground inline-flex size-5 items-center justify-center rounded-full text-xs font-semibold"
            >
              {{ favoritesStore.count }}
            </span>
          </NuxtLink>
          <NuxtLink
            :to="localePath('/portal/account')"
            class="text-primary hover:text-primary/80 flex items-center gap-2 font-medium"
          >
            <Icon name="lucide:user" class="size-4" />
            {{ t('portal.quick_links.account') }}
          </NuxtLink>
          <button
            type="button"
            class="text-primary hover:text-primary/80 flex items-center gap-2 text-left font-medium"
            @click="handleLogout"
          >
            <Icon name="lucide:log-out" class="size-4" />
            {{ t('portal.quick_links.logout') }}
          </button>
        </div>
      </div>

      <!-- Tab Navigation -->
      <nav
        data-testid="portal-tabs"
        class="border-border mt-6 flex gap-1 overflow-x-auto border-b"
      >
        <NuxtLink
          v-for="tab in visibleTabs"
          :key="tab.key"
          :to="localePath(tab.to)"
          class="flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors"
          :class="
            isActiveTab(tab)
              ? 'border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:border-border border-transparent'
          "
        >
          <Icon :name="tab.icon" class="size-4" />
          {{ t(tab.label) }}
        </NuxtLink>
      </nav>

      <!-- Page Content -->
      <div class="py-8">
        <slot />
      </div>
    </div>
  </div>
</template>
