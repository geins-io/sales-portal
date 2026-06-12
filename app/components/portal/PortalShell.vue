<script setup lang="ts">
import type { FunctionalComponent } from 'vue';
import {
  Building2,
  FileText,
  LayoutDashboard,
  List,
  LogOut,
  Package,
  ShoppingBag,
  Star,
  User,
} from 'lucide-vue-next';
import type { GeinsUserType } from '@geins/types';
import type { ContentAreaType } from '#shared/types/cms';
import { CMS_SLOTS } from '#shared/types/cms-slots';
import { useAuthStore } from '~/stores/auth';
import { useFavoritesStore } from '~/stores/favorites';

const { t } = useI18n();
const route = useRoute();
const authStore = useAuthStore();
const { canAccess } = useFeatureAccess();
const { hasFeature } = useTenant();
const { localePath, currentLocale, currentMarket } = useLocaleMarket();
const { logout } = useLogout();
const favoritesStore = useFavoritesStore();

// Resolve the portal hero CMS slot from tenant config. The slot is null
// when the tenant has not configured it; in that case we skip the fetch
// and PortalHeroFallback renders below. See docs/patterns/cms-slots.md.
const heroSlot = useCmsSlot(CMS_SLOTS.PORTAL_HERO);
const { data: heroArea } = useFetch<ContentAreaType>('/api/cms/area', {
  query: computed(() =>
    heroSlot.value
      ? {
          family: heroSlot.value.family,
          areaName: heroSlot.value.areaName,
          ...(currentLocale.value ? { locale: currentLocale.value } : {}),
          ...(currentMarket.value ? { market: currentMarket.value } : {}),
        }
      : { skip: '1' },
  ),
  immediate: !!heroSlot.value,
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
  icon: FunctionalComponent;
  feature?: string;
}

const tabs: PortalTab[] = [
  {
    key: 'overview',
    label: 'portal.tabs.overview',
    to: '/portal',
    icon: LayoutDashboard,
  },
  {
    key: 'orders',
    label: 'portal.tabs.orders',
    to: '/portal/orders',
    icon: ShoppingBag,
    feature: 'orderHistory',
  },
  {
    key: 'quotations',
    label: 'portal.tabs.quotations',
    to: '/portal/quotations',
    icon: FileText,
    feature: 'quotes',
  },
  {
    key: 'products',
    label: 'portal.tabs.products',
    to: '/portal/products',
    icon: Package,
  },
  {
    key: 'lists',
    label: 'portal.tabs.lists',
    to: '/portal/lists',
    icon: List,
    feature: 'lists',
  },
  {
    key: 'organisation',
    label: 'portal.tabs.organisation',
    to: '/portal/organisation',
    icon: Building2,
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

</script>

<template>
  <div data-testid="portal-shell">
    <!-- Hero Banner: CMS-driven when configured, fallback otherwise.
         Wrapper mirrors the welcome wrapper width so both align flush. -->
    <div class="mx-auto max-w-7xl px-4 lg:px-0">
      <CmsWidgetArea
        v-if="heroArea?.containers?.length"
        flush
        data-testid="portal-hero"
        :containers="heroArea.containers"
      />
      <PortalHeroFallback v-else />
    </div>

    <!-- Welcome Card -->
    <!-- Page content uses 1280px container (max-w-7xl). Side padding only
         on smaller viewports, flush edges at 1280+ per Figma. -->
    <div class="mx-auto max-w-7xl px-4 lg:px-0">
      <div
        data-testid="portal-welcome"
        class="border-border bg-background mt-8 flex flex-col gap-6 rounded-lg border p-6 shadow-sm sm:flex-row sm:items-start sm:justify-between"
      >
        <!-- Left: User info -->
        <div>
          <h2 class="text-2xl font-semibold">
            {{ t('portal.welcome', { name: welcomeName }) }}
          </h2>
          <p class="text-muted-foreground mt-3 text-sm">
            {{ t('portal.customer_no', { id: customerNo, email }) }}
          </p>
          <p v-if="orgName" class="text-muted-foreground text-sm">
            {{ t('portal.organisation', { org: orgName }) }}
          </p>
        </div>

        <!-- Right: Quick links — left-bordered + left-aligned + icons per Figma -->
        <div
          class="border-border flex flex-col items-start gap-3 text-sm sm:border-l sm:pl-6"
        >
          <NuxtLink
            v-if="hasFeature('wishlist')"
            :to="localePath('/portal/favorites')"
            class="text-primary hover:text-primary/80 flex items-center gap-2"
          >
            <Star class="size-4" />
            <span>
              {{ t('portal.quick_links.favorites')
              }}<span
                v-if="favoritesStore.count > 0"
                data-testid="favorites-count"
              >
                ({{ favoritesStore.count }})</span
              >
            </span>
          </NuxtLink>
          <NuxtLink
            :to="localePath('/portal/account')"
            class="text-primary hover:text-primary/80 flex items-center gap-2"
          >
            <User class="size-4" />
            {{ t('portal.quick_links.account') }}
          </NuxtLink>
          <button
            type="button"
            class="text-primary hover:text-primary/80 flex items-center gap-2"
            @click="logout"
          >
            <LogOut class="size-4" />
            {{ t('portal.quick_links.logout') }}
          </button>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="relative mt-6">
        <nav
          data-testid="portal-tabs"
          class="border-border scrollbar-none flex gap-1 overflow-x-auto border-b"
        >
          <NuxtLink
            v-for="tab in visibleTabs"
            :key="tab.key"
            :to="localePath(tab.to)"
            class="flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors md:px-4"
            :class="
              isActiveTab(tab)
                ? 'border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:border-border border-transparent'
            "
          >
            <component :is="tab.icon" class="hidden size-4 md:block" />
            {{ t(tab.label) }}
          </NuxtLink>
        </nav>
        <!-- Scroll hint fade on mobile -->
        <div
          class="from-background pointer-events-none absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-l md:hidden"
        />
      </div>

      <!-- Page Content -->
      <div class="py-8">
        <slot />
      </div>
    </div>
  </div>
</template>
