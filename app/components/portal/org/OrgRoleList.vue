<script setup lang="ts">
import type { Buyer, BuyerRole } from '#shared/types/b2b';
import { DEFAULT_ROLES } from '#shared/types/b2b';
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
  buyers: Buyer[];
  canManageRoles: boolean;
}>();

const roles = computed(() =>
  Object.entries(DEFAULT_ROLES).map(([key, role]) => ({
    key: key as BuyerRole,
    label: role.label,
    description: role.description,
    assignedCount: props.buyers.filter((b) => b.role === key).length,
  })),
);
</script>

<template>
  <div data-testid="org-role-list">
    <!-- Header -->
    <div class="mb-4 flex items-center justify-between">
      <h3 class="text-lg font-semibold">
        {{ t('portal.org.roles.title') }}
      </h3>
      <div class="flex gap-2">
        <Button size="sm" disabled data-testid="role-add-btn">
          <Icon name="lucide:plus" class="mr-1 size-4" />
          {{ t('portal.org.roles.add') }}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled
          data-testid="role-save-btn"
        >
          {{ t('portal.org.roles.save') }}
        </Button>
      </div>
    </div>

    <!-- Table -->
    <Table data-testid="roles-table">
      <TableHeader>
        <TableRow>
          <TableHead>{{ t('portal.org.roles.col_role') }}</TableHead>
          <TableHead>{{ t('portal.org.roles.col_description') }}</TableHead>
          <TableHead>{{ t('portal.org.roles.col_assigned') }}</TableHead>
          <TableHead v-if="canManageRoles">
            {{ t('portal.org.buyers.col_actions') }}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow
          v-for="role in roles"
          :key="role.key"
          :data-testid="`role-row-${role.key}`"
        >
          <TableCell class="font-medium">
            {{ role.label }}
          </TableCell>
          <TableCell class="text-muted-foreground text-sm">
            {{ role.description }}
          </TableCell>
          <TableCell>
            {{ role.assignedCount }}
          </TableCell>
          <TableCell v-if="canManageRoles">
            <div class="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                :data-testid="`role-edit-${role.key}`"
                class="size-8 p-0"
                disabled
              >
                <Icon name="lucide:pencil" class="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                :data-testid="`role-delete-${role.key}`"
                class="size-8 p-0"
                disabled
              >
                <Icon name="lucide:trash-2" class="size-4" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
