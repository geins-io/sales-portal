<script setup lang="ts">
import type { Organization, Buyer, OrgAddress } from '#shared/types/b2b';
import { hasPermission } from '#shared/types/b2b';

definePageMeta({ middleware: 'auth' });

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const VALID_TABS = ['info', 'persons', 'addresses', 'roles'] as const;

const activeTab = computed({
  get: () => {
    const tab = route.query.tab as string | undefined;
    // Backward compat: treat "buyers" as "persons"
    if (tab === 'buyers') return 'persons';
    return tab && (VALID_TABS as readonly string[]).includes(tab)
      ? tab
      : 'info';
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

const { data: addressData, refresh: refreshAddresses } = useFetch<{
  addresses: OrgAddress[];
}>('/api/organization/addresses', {
  dedupe: 'defer',
});

const { data: buyersData } = useFetch<{ buyers: Buyer[] }>(
  '/api/organization/buyers',
  { dedupe: 'defer' },
);

const organization = computed(() => orgData.value?.organization);
const buyer = computed(() => meData.value?.buyer);
const addresses = computed(() => addressData.value?.addresses ?? []);
const buyers = computed(() => buyersData.value?.buyers ?? []);
const canEdit = computed(() => {
  if (!buyer.value) return false;
  return hasPermission(buyer.value.role, 'org:edit');
});
const canManageAddresses = computed(() => {
  if (!buyer.value) return false;
  return hasPermission(buyer.value.role, 'org:manage_addresses');
});
const canManageRoles = computed(() => {
  if (!buyer.value) return false;
  return hasPermission(buyer.value.role, 'org:manage_roles');
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
      <div class="grid gap-8 md:grid-cols-[200px_1fr]">
        <OrgSubNav v-model="activeTab" />

        <div>
          <!-- Info tab -->
          <OrgInfoCard
            v-if="activeTab === 'info'"
            :organization="organization"
            :can-edit="canEdit"
            @updated="handleOrgUpdated"
          />

          <!-- Persons tab -->
          <OrgBuyerList
            v-else-if="activeTab === 'persons'"
            :current-buyer="buyer"
          />

          <!-- Addresses tab -->
          <OrgAddressBook
            v-else-if="activeTab === 'addresses'"
            :addresses="addresses"
            :can-manage="canManageAddresses"
            @refresh="refreshAddresses"
          />

          <!-- Roles tab -->
          <OrgRoleList
            v-else-if="activeTab === 'roles'"
            :buyers="buyers"
            :can-manage-roles="canManageRoles"
          />
        </div>
      </div>
    </template>
  </PortalShell>
</template>
