<script setup lang="ts">
import type { Organization, Buyer } from '#shared/types/b2b';
import { hasPermission } from '#shared/types/b2b';

definePageMeta({ middleware: 'auth' });

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const activeTab = computed({
  get: () => {
    const tab = route.query.tab as string | undefined;
    return tab && ['info', 'addresses', 'buyers'].includes(tab) ? tab : 'info';
  },
  set: (value: string) => {
    router.replace({ query: { ...route.query, tab: value } });
  },
});

const {
  data: orgData,
  pending: orgPending,
  error: orgError,
} = useFetch<{ organization: Organization }>('/api/organization', {
  dedupe: 'defer',
});

const {
  data: meData,
  pending: mePending,
  error: meError,
} = useFetch<{ buyer: Buyer }>('/api/organization/me', {
  dedupe: 'defer',
});

const organization = computed(() => orgData.value?.organization);
const buyer = computed(() => meData.value?.buyer);
const canEdit = computed(() => {
  if (!buyer.value) return false;
  return hasPermission(buyer.value.role, 'org:edit');
});
const isLoading = computed(() => orgPending.value || mePending.value);
const hasError = computed(() => !!orgError.value || !!meError.value);

function handleOrgUpdated(updated: Organization) {
  if (orgData.value) {
    orgData.value.organization = updated;
  }
}
</script>

<template>
  <PortalShell>
    <!-- Loading -->
    <div
      v-if="isLoading"
      data-testid="org-loading"
      class="text-muted-foreground py-16 text-center text-sm"
    >
      {{ t('common.loading') }}
    </div>

    <!-- Error -->
    <div
      v-else-if="hasError"
      data-testid="org-error"
      class="flex flex-col items-center justify-center py-16 text-center"
    >
      <div
        class="bg-destructive/10 text-destructive mb-4 flex size-12 items-center justify-center rounded-full"
      >
        <Icon name="lucide:alert-triangle" class="size-6" />
      </div>
      <h2 class="text-lg font-semibold">
        {{ t('portal.org.error_title') }}
      </h2>
      <p class="text-muted-foreground mt-1 text-sm">
        {{ t('portal.org.error_description') }}
      </p>
    </div>

    <!-- Content -->
    <template v-else-if="organization && buyer">
      <OrgSubNav :active-tab="activeTab" @update:tab="activeTab = $event" />

      <!-- Info tab -->
      <OrgInfoCard
        v-if="activeTab === 'info'"
        :organization="organization"
        :can-edit="canEdit"
        @updated="handleOrgUpdated"
      />

      <!-- Addresses tab (placeholder) -->
      <PortalPlaceholder v-else-if="activeTab === 'addresses'" />

      <!-- Buyers tab (placeholder) -->
      <PortalPlaceholder v-else-if="activeTab === 'buyers'" />
    </template>
  </PortalShell>
</template>
