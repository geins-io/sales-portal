<script setup lang="ts">
import type { Buyer, BuyerRole } from '#shared/types/b2b';
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

function truncateId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}...` : id;
}

function formatLastLogin(dateStr?: string): string {
  if (!dateStr) return '\u2014';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '\u2014';
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
        <Icon name="lucide:plus" class="mr-1 size-4" />
        {{ t('portal.org.persons.add') }}
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
          <TableHead>{{ t('portal.org.persons.col_id') }}</TableHead>
          <TableHead>{{ t('portal.org.buyers.col_email') }}</TableHead>
          <TableHead>{{ t('portal.org.buyers.col_role') }}</TableHead>
          <TableHead>{{ t('portal.org.persons.col_latest_login') }}</TableHead>
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
          <!-- Id -->
          <TableCell>
            <span :title="b.id" class="font-mono text-xs">
              {{ truncateId(b.id) }}
            </span>
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

          <!-- Latest login -->
          <TableCell>
            <span :data-testid="`buyer-last-login-${b.id}`">
              {{ formatLastLogin(b.lastLogin) }}
            </span>
          </TableCell>

          <!-- Actions -->
          <TableCell v-if="canManageBuyers">
            <template v-if="!isSelf(b)">
              <div class="flex items-center gap-1">
                <!-- Edit (placeholder) -->
                <Button
                  variant="ghost"
                  size="sm"
                  :data-testid="`buyer-edit-${b.id}`"
                  class="size-8 p-0"
                >
                  <Icon name="lucide:pencil" class="size-4" />
                </Button>

                <!-- Delete / deactivate with confirmation -->
                <Button
                  v-if="confirmingDeactivateId !== b.id"
                  variant="ghost"
                  size="sm"
                  :data-testid="`buyer-delete-${b.id}`"
                  class="size-8 p-0"
                  @click="confirmingDeactivateId = b.id"
                >
                  <Icon name="lucide:trash-2" class="size-4" />
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
              </div>
            </template>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
