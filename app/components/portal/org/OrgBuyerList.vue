<script setup lang="ts">
import type { Buyer, BuyerRole, BuyerStatus } from '#shared/types/b2b';
import { DEFAULT_ROLES, hasPermission } from '#shared/types/b2b';
import { Button } from '~/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';

const { t } = useI18n();

const props = defineProps<{
  currentBuyer: Buyer;
}>();

const {
  data: buyersData,
  pending: buyersPending,
  error: buyersError,
  refresh: refreshBuyers,
} = useFetch<{ buyers: Buyer[] }>('/api/organization/buyers', {
  dedupe: 'defer',
});

const buyers = computed(() => buyersData.value?.buyers ?? []);

const canManageBuyers = computed(() =>
  hasPermission(props.currentBuyer.role, 'org:manage_buyers'),
);
const canManageRoles = computed(() =>
  hasPermission(props.currentBuyer.role, 'org:manage_roles'),
);

const showInviteForm = ref(false);
const confirmingDeactivateId = ref<string | null>(null);
const actionError = ref('');

function statusBadgeClass(status: BuyerStatus): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'invited':
      return 'bg-yellow-100 text-yellow-800';
    case 'deactivated':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function isSelf(buyer: Buyer): boolean {
  return buyer.id === props.currentBuyer.id;
}

function handleBuyerInvited() {
  showInviteForm.value = false;
  refreshBuyers();
}

function handleRoleUpdated(buyer: Buyer, newRole: BuyerRole) {
  if (buyersData.value) {
    const idx = buyersData.value.buyers.findIndex((b) => b.id === buyer.id);
    if (idx !== -1) {
      buyersData.value.buyers[idx]!.role = newRole;
    }
  }
}

async function handleDeactivate(buyer: Buyer) {
  actionError.value = '';
  try {
    await $fetch(`/api/organization/buyers/${buyer.id}/deactivate`, {
      method: 'PATCH',
    });
    confirmingDeactivateId.value = null;
    refreshBuyers();
  } catch {
    actionError.value = t('portal.org.buyers.deactivate_error');
  }
}

async function handleReactivate(buyer: Buyer) {
  actionError.value = '';
  try {
    await $fetch(`/api/organization/buyers/${buyer.id}/reactivate`, {
      method: 'PATCH',
    });
    refreshBuyers();
  } catch {
    actionError.value = t('portal.org.buyers.reactivate_error');
  }
}
</script>

<template>
  <div data-testid="org-buyer-list">
    <!-- Header -->
    <div class="mb-4 flex items-center justify-between">
      <h3 class="text-lg font-semibold">
        {{ t('portal.org.buyers.title') }}
      </h3>
      <Button
        v-if="canManageBuyers && !showInviteForm"
        size="sm"
        data-testid="buyer-invite-btn"
        @click="showInviteForm = true"
      >
        <Icon name="lucide:user-plus" class="mr-1 size-4" />
        {{ t('portal.org.buyers.invite') }}
      </Button>
    </div>

    <!-- Invite form -->
    <OrgBuyerInviteForm
      v-if="showInviteForm"
      class="mb-6"
      @invited="handleBuyerInvited"
      @cancel="showInviteForm = false"
    />

    <!-- Action error -->
    <div
      v-if="actionError"
      data-testid="buyer-action-error"
      class="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm"
    >
      {{ actionError }}
    </div>

    <!-- Loading -->
    <div
      v-if="buyersPending"
      data-testid="buyers-loading"
      class="text-muted-foreground py-8 text-center text-sm"
    >
      {{ t('common.loading') }}
    </div>

    <!-- Error -->
    <div
      v-else-if="buyersError"
      data-testid="buyers-error"
      class="text-destructive py-8 text-center text-sm"
    >
      {{ t('portal.org.buyers.load_error') }}
    </div>

    <!-- Empty -->
    <div
      v-else-if="buyers.length === 0"
      data-testid="buyers-empty"
      class="text-muted-foreground py-8 text-center text-sm"
    >
      {{ t('portal.org.buyers.empty') }}
    </div>

    <!-- Table -->
    <Table v-else data-testid="buyers-table">
      <TableHeader>
        <TableRow>
          <TableHead>{{ t('portal.org.buyers.col_name') }}</TableHead>
          <TableHead>{{ t('portal.org.buyers.col_email') }}</TableHead>
          <TableHead>{{ t('portal.org.buyers.col_role') }}</TableHead>
          <TableHead>{{ t('portal.org.buyers.col_status') }}</TableHead>
          <TableHead v-if="canManageBuyers">
            {{ t('portal.org.buyers.col_actions') }}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow
          v-for="b in buyers"
          :key="b.id"
          :data-testid="`buyer-row-${b.id}`"
        >
          <!-- Name -->
          <TableCell>
            {{ b.firstName }} {{ b.lastName }}
            <span v-if="isSelf(b)" class="text-muted-foreground ml-1 text-xs">
              ({{ t('portal.org.buyers.you') }})
            </span>
          </TableCell>

          <!-- Email -->
          <TableCell>{{ b.email }}</TableCell>

          <!-- Role -->
          <TableCell>
            <OrgBuyerRoleSelect
              v-if="canManageRoles && !isSelf(b)"
              :buyer-id="b.id"
              :model-value="b.role"
              @update:model-value="handleRoleUpdated(b, $event)"
            />
            <span v-else>{{ DEFAULT_ROLES[b.role].label }}</span>
          </TableCell>

          <!-- Status -->
          <TableCell>
            <span
              :data-testid="`buyer-status-${b.id}`"
              class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
              :class="statusBadgeClass(b.status)"
            >
              {{ t(`portal.org.buyers.status_${b.status}`) }}
            </span>
          </TableCell>

          <!-- Actions -->
          <TableCell v-if="canManageBuyers">
            <template v-if="!isSelf(b)">
              <!-- Deactivated: show reactivate -->
              <Button
                v-if="b.status === 'deactivated'"
                variant="outline"
                size="sm"
                :data-testid="`buyer-reactivate-${b.id}`"
                @click="handleReactivate(b)"
              >
                {{ t('portal.org.buyers.reactivate') }}
              </Button>

              <!-- Active/invited: show deactivate with confirmation -->
              <template v-else>
                <Button
                  v-if="confirmingDeactivateId !== b.id"
                  variant="outline"
                  size="sm"
                  :data-testid="`buyer-deactivate-${b.id}`"
                  @click="confirmingDeactivateId = b.id"
                >
                  {{ t('portal.org.buyers.deactivate') }}
                </Button>
                <div
                  v-else
                  class="flex items-center gap-2"
                  :data-testid="`buyer-confirm-deactivate-${b.id}`"
                >
                  <span class="text-muted-foreground text-xs">
                    {{ t('portal.org.buyers.confirm_deactivate') }}
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    :data-testid="`buyer-confirm-yes-${b.id}`"
                    @click="handleDeactivate(b)"
                  >
                    {{ t('common.yes') }}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    :data-testid="`buyer-confirm-no-${b.id}`"
                    @click="confirmingDeactivateId = null"
                  >
                    {{ t('common.no') }}
                  </Button>
                </div>
              </template>
            </template>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
