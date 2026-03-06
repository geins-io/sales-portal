<script setup lang="ts">
import type { OrgAddress } from '#shared/types/b2b';
import { Button } from '~/components/ui/button';

const { t } = useI18n();

defineProps<{
  addresses: OrgAddress[];
  canManage: boolean;
}>();

const emit = defineEmits<{
  refresh: [];
}>();

const showForm = ref(false);
const editingAddress = ref<OrgAddress | undefined>();
const removingId = ref<string | null>(null);
const errorMessage = ref('');

function openAddForm() {
  editingAddress.value = undefined;
  showForm.value = true;
  errorMessage.value = '';
}

function openEditForm(address: OrgAddress) {
  editingAddress.value = address;
  showForm.value = true;
  errorMessage.value = '';
}

function closeForm() {
  showForm.value = false;
  editingAddress.value = undefined;
}

function handleSaved() {
  closeForm();
  emit('refresh');
}

function startRemove(id: string) {
  removingId.value = id;
}

function cancelRemove() {
  removingId.value = null;
}

async function confirmRemove(id: string) {
  errorMessage.value = '';
  try {
    await $fetch(`/api/organization/addresses/${id}`, { method: 'DELETE' });
    removingId.value = null;
    emit('refresh');
  } catch {
    errorMessage.value = t('portal.org.addresses.remove_error');
    removingId.value = null;
  }
}

function formatAddress(address: OrgAddress): string {
  const parts = [
    address.address.addressLine1,
    address.address.addressLine2,
    address.address.addressLine3,
    [address.address.postalCode, address.address.city]
      .filter(Boolean)
      .join(' '),
    address.address.country,
  ].filter(Boolean);
  return parts.join(', ');
}
</script>

<template>
  <div data-testid="org-address-book">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h3 class="text-lg font-semibold">
          {{ t('portal.org.addresses.title') }}
        </h3>
        <p class="text-muted-foreground mt-1 text-sm">
          {{ t('portal.org.addresses.subtitle') }}
        </p>
      </div>
      <Button
        v-if="canManage && !showForm"
        variant="outline"
        size="sm"
        data-testid="address-add-btn"
        @click="openAddForm"
      >
        <Icon name="lucide:plus" class="mr-1 size-4" />
        {{ t('portal.org.addresses.add') }}
      </Button>
    </div>

    <!-- Error message -->
    <div
      v-if="errorMessage"
      data-testid="address-book-error"
      class="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm"
    >
      {{ errorMessage }}
    </div>

    <!-- Inline form -->
    <OrgAddressForm
      v-if="showForm"
      :address="editingAddress"
      class="mb-6"
      @saved="handleSaved"
      @cancel="closeForm"
    />

    <!-- Empty state -->
    <div
      v-if="!addresses.length && !showForm"
      data-testid="address-empty"
      class="text-muted-foreground py-12 text-center text-sm"
    >
      {{ t('portal.org.addresses.empty') }}
    </div>

    <!-- Address cards -->
    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div
        v-for="addr in addresses"
        :key="addr.id"
        :data-testid="`address-card-${addr.id}`"
        class="border-border rounded-lg border p-4"
      >
        <div class="mb-2 flex items-start justify-between">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold">{{ addr.label }}</span>
            <span
              v-if="addr.isDefault"
              data-testid="address-default-badge"
              class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
            >
              {{ t('portal.org.addresses.default') }}
            </span>
          </div>
          <div v-if="canManage" class="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              :data-testid="`address-edit-${addr.id}`"
              @click="openEditForm(addr)"
            >
              <Icon name="lucide:pencil" class="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              :data-testid="`address-remove-${addr.id}`"
              @click="startRemove(addr.id)"
            >
              <Icon name="lucide:trash-2" class="text-destructive size-4" />
            </Button>
          </div>
        </div>

        <!-- Contact name -->
        <p
          v-if="addr.address.firstName || addr.address.lastName"
          class="text-sm"
        >
          {{
            [addr.address.firstName, addr.address.lastName]
              .filter(Boolean)
              .join(' ')
          }}
        </p>

        <!-- Full address -->
        <p class="text-muted-foreground text-sm">
          {{ formatAddress(addr) }}
        </p>

        <!-- Phone -->
        <p v-if="addr.address.phone" class="text-muted-foreground mt-1 text-sm">
          {{ addr.address.phone }}
        </p>

        <!-- Remove confirmation -->
        <div
          v-if="removingId === addr.id"
          data-testid="address-confirm-remove"
          class="bg-destructive/5 mt-3 flex items-center justify-between rounded-md p-3"
        >
          <span class="text-sm">
            {{ t('portal.org.addresses.confirm_remove') }}
          </span>
          <div class="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              data-testid="address-confirm-yes"
              @click="confirmRemove(addr.id)"
            >
              {{ t('portal.org.addresses.remove') }}
            </Button>
            <Button
              variant="outline"
              size="sm"
              data-testid="address-confirm-no"
              @click="cancelRemove"
            >
              {{ t('common.cancel') }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
