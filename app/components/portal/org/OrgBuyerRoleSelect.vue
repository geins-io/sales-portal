<script setup lang="ts">
import type { BuyerRole } from '#shared/types/b2b';
import { DEFAULT_ROLES } from '#shared/types/b2b';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';

const props = defineProps<{
  buyerId: string;
  modelValue: BuyerRole;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [role: BuyerRole];
}>();

const isUpdating = ref(false);
const errorMessage = ref('');

const roleOptions = Object.values(DEFAULT_ROLES);

async function handleRoleChange(value: unknown) {
  if (typeof value !== 'string') return;
  const newRole = value as BuyerRole;
  if (newRole === props.modelValue) return;

  isUpdating.value = true;
  errorMessage.value = '';

  try {
    await $fetch(`/api/organization/buyers/${props.buyerId}/role`, {
      method: 'PATCH',
      body: { role: newRole },
    });
    emit('update:modelValue', newRole);
  } catch {
    errorMessage.value = 'Failed to update role';
  } finally {
    isUpdating.value = false;
  }
}
</script>

<template>
  <div data-testid="buyer-role-select" class="inline-flex flex-col">
    <Select
      :model-value="modelValue"
      :disabled="disabled || isUpdating"
      @update:model-value="handleRoleChange"
    >
      <SelectTrigger size="sm" :data-testid="`buyer-role-trigger-${buyerId}`">
        <SelectValue :placeholder="DEFAULT_ROLES[modelValue].label" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="opt in roleOptions"
          :key="opt.role"
          :value="opt.role"
          :data-testid="`buyer-role-option-${opt.role}`"
        >
          {{ opt.label }}
        </SelectItem>
      </SelectContent>
    </Select>
    <span
      v-if="errorMessage"
      data-testid="buyer-role-error"
      class="text-destructive mt-1 text-xs"
    >
      {{ errorMessage }}
    </span>
  </div>
</template>
