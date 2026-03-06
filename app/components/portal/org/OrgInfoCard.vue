<script setup lang="ts">
import type { Organization } from '#shared/types/b2b';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Button } from '~/components/ui/button';

const { t } = useI18n();

const props = defineProps<{
  organization: Organization;
  canEdit: boolean;
}>();

const emit = defineEmits<{
  updated: [organization: Organization];
}>();

const isEditing = ref(false);
const isLoading = ref(false);
const successMessage = ref('');
const errorMessage = ref('');

const formData = reactive({
  name: props.organization.name,
  organizationNumber: props.organization.organizationNumber,
  referenceContact: props.organization.referenceContact ?? '',
  email: props.organization.email ?? '',
  phone: props.organization.phone ?? '',
});

watch(
  () => props.organization,
  (org) => {
    formData.name = org.name;
    formData.organizationNumber = org.organizationNumber;
    formData.referenceContact = org.referenceContact ?? '';
    formData.email = org.email ?? '';
    formData.phone = org.phone ?? '';
  },
);

interface OrgField {
  name: keyof typeof formData;
  label: string;
  type: string;
  halfWidth?: boolean;
}

const fields: OrgField[] = [
  { name: 'name', label: 'portal.org.info.name', type: 'text' },
  {
    name: 'organizationNumber',
    label: 'portal.org.info.org_number',
    type: 'text',
  },
  {
    name: 'referenceContact',
    label: 'portal.org.info.reference_contact',
    type: 'text',
  },
  {
    name: 'email',
    label: 'portal.org.info.email',
    type: 'email',
    halfWidth: true,
  },
  {
    name: 'phone',
    label: 'portal.org.info.phone',
    type: 'tel',
    halfWidth: true,
  },
];

const statusVariant = computed(() => {
  switch (props.organization.status) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'suspended':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-muted text-muted-foreground';
  }
});

function startEditing() {
  successMessage.value = '';
  errorMessage.value = '';
  isEditing.value = true;
}

function cancelEditing() {
  formData.name = props.organization.name;
  formData.organizationNumber = props.organization.organizationNumber;
  formData.referenceContact = props.organization.referenceContact ?? '';
  formData.email = props.organization.email ?? '';
  formData.phone = props.organization.phone ?? '';
  isEditing.value = false;
  errorMessage.value = '';
}

async function handleSubmit() {
  isLoading.value = true;
  successMessage.value = '';
  errorMessage.value = '';

  try {
    const result = await $fetch<{ organization: Organization }>(
      '/api/organization',
      {
        method: 'PATCH',
        body: { ...formData },
      },
    );
    successMessage.value = t('portal.org.info.save_success');
    isEditing.value = false;
    if (result.organization) {
      emit('updated', result.organization);
    }
  } catch {
    errorMessage.value = t('portal.org.info.save_error');
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div data-testid="org-info-card" class="border-border rounded-lg border p-6">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h3 class="text-lg font-semibold">
          {{ t('portal.org.info.title') }}
        </h3>
        <p class="text-muted-foreground mt-1 text-sm">
          {{ t('portal.org.info.subtitle') }}
        </p>
      </div>
      <div class="flex items-center gap-3">
        <span
          data-testid="org-status-badge"
          class="rounded-full px-3 py-1 text-xs font-medium"
          :class="statusVariant"
        >
          {{ t(`portal.org.status.${organization.status}`) }}
        </span>
        <Button
          v-if="canEdit && !isEditing"
          variant="outline"
          size="sm"
          data-testid="org-edit-btn"
          @click="startEditing"
        >
          <Icon name="lucide:pencil" class="mr-1 size-4" />
          {{ t('portal.org.info.edit') }}
        </Button>
      </div>
    </div>

    <!-- Success / Error messages -->
    <div
      v-if="successMessage"
      data-testid="org-info-success"
      class="bg-primary/10 text-primary mb-4 rounded-md p-3 text-sm"
    >
      {{ successMessage }}
    </div>
    <div
      v-if="errorMessage"
      data-testid="org-info-error"
      class="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm"
    >
      {{ errorMessage }}
    </div>

    <!-- Read-only view -->
    <div v-if="!isEditing" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div v-for="field in fields" :key="field.name" class="space-y-1">
        <p class="text-muted-foreground text-sm">{{ t(field.label) }}</p>
        <p class="text-sm font-medium" :data-testid="`org-${field.name}`">
          {{ formData[field.name] || '-' }}
        </p>
      </div>
    </div>

    <!-- Edit form -->
    <form
      v-else
      data-testid="org-info-form"
      class="space-y-4"
      @submit.prevent="handleSubmit"
    >
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div
          v-for="field in fields"
          :key="field.name"
          class="space-y-2"
          :class="field.halfWidth ? '' : 'sm:col-span-2'"
        >
          <Label :for="`org-${field.name}`">{{ t(field.label) }}</Label>
          <Input
            :id="`org-${field.name}`"
            v-model="formData[field.name]"
            :type="field.type"
            :disabled="isLoading"
            :data-testid="`org-input-${field.name}`"
          />
        </div>
      </div>

      <div class="flex gap-2">
        <Button type="submit" :disabled="isLoading" data-testid="org-info-save">
          {{
            isLoading ? t('portal.org.info.saving') : t('portal.org.info.save')
          }}
        </Button>
        <Button
          type="button"
          variant="outline"
          :disabled="isLoading"
          data-testid="org-info-cancel"
          @click="cancelEditing"
        >
          {{ t('common.cancel') }}
        </Button>
      </div>
    </form>
  </div>
</template>
