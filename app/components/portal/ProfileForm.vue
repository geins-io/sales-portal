<script setup lang="ts">
import type { GeinsUserType } from '@geins/types';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Button } from '~/components/ui/button';

const { t } = useI18n();

const props = defineProps<{
  profile: GeinsUserType;
  hideSubmitButton?: boolean;
}>();

const emit = defineEmits<{
  saved: [profile: GeinsUserType];
}>();

const isLoading = ref(false);
const successMessage = ref('');
const errorMessage = ref('');

const formData = reactive({
  firstName: props.profile.address?.firstName ?? '',
  lastName: props.profile.address?.lastName ?? '',
  company: props.profile.address?.company ?? '',
  phone: props.profile.address?.phone ?? '',
  mobile: props.profile.address?.mobile ?? '',
  addressLine1: props.profile.address?.addressLine1 ?? '',
  addressLine2: props.profile.address?.addressLine2 ?? '',
  zip: props.profile.address?.zip ?? '',
  city: props.profile.address?.city ?? '',
  country: props.profile.address?.country ?? '',
});

interface ProfileField {
  name: keyof typeof formData;
  label: string;
  type: string;
  autoComplete?: string;
  halfWidth?: boolean;
}

const fields: ProfileField[] = [
  {
    name: 'firstName',
    label: 'portal.account.first_name',
    type: 'text',
    autoComplete: 'given-name',
    halfWidth: true,
  },
  {
    name: 'lastName',
    label: 'portal.account.last_name',
    type: 'text',
    autoComplete: 'family-name',
    halfWidth: true,
  },
  {
    name: 'company',
    label: 'portal.account.company',
    type: 'text',
    autoComplete: 'organization',
  },
  {
    name: 'phone',
    label: 'portal.account.phone',
    type: 'tel',
    autoComplete: 'tel',
    halfWidth: true,
  },
  {
    name: 'mobile',
    label: 'portal.account.mobile',
    type: 'tel',
    autoComplete: 'tel',
    halfWidth: true,
  },
  {
    name: 'addressLine1',
    label: 'portal.account.address_line1',
    type: 'text',
    autoComplete: 'address-line1',
  },
  {
    name: 'addressLine2',
    label: 'portal.account.address_line2',
    type: 'text',
    autoComplete: 'address-line2',
  },
  {
    name: 'zip',
    label: 'portal.account.zip',
    type: 'text',
    autoComplete: 'postal-code',
    halfWidth: true,
  },
  {
    name: 'city',
    label: 'portal.account.city',
    type: 'text',
    autoComplete: 'address-level2',
    halfWidth: true,
  },
  {
    name: 'country',
    label: 'portal.account.country',
    type: 'text',
    autoComplete: 'country-name',
  },
];

async function handleSubmit() {
  isLoading.value = true;
  successMessage.value = '';
  errorMessage.value = '';

  try {
    const result = await $fetch<{ profile: GeinsUserType }>(
      '/api/user/profile',
      {
        method: 'PUT',
        body: {
          address: { ...formData },
        },
      },
    );
    successMessage.value = t('portal.account.save_success');
    if (result.profile) {
      emit('saved', result.profile);
    }
  } catch {
    errorMessage.value = t('portal.account.save_error');
  } finally {
    isLoading.value = false;
  }
}

defineExpose({ submit: handleSubmit, isLoading: readonly(isLoading) });
</script>

<template>
  <form
    data-testid="profile-form"
    class="space-y-6"
    @submit.prevent="handleSubmit"
  >
    <!-- Success / Error messages -->
    <div
      v-if="successMessage"
      data-testid="profile-success"
      class="bg-primary/10 text-primary rounded-md p-3 text-sm"
    >
      {{ successMessage }}
    </div>
    <div
      v-if="errorMessage"
      data-testid="profile-error"
      class="bg-destructive/10 text-destructive rounded-md p-3 text-sm"
    >
      {{ errorMessage }}
    </div>

    <!-- Email (read-only) -->
    <div class="space-y-2">
      <Label for="profile-email">{{ t('portal.account.email') }}</Label>
      <Input
        id="profile-email"
        :model-value="profile.email"
        type="email"
        disabled
        data-testid="profile-email"
      />
    </div>

    <!-- Dynamic fields -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div
        v-for="field in fields"
        :key="field.name"
        class="space-y-2"
        :class="field.halfWidth ? '' : 'sm:col-span-2'"
      >
        <Label :for="`profile-${field.name}`">{{ t(field.label) }}</Label>
        <Input
          :id="`profile-${field.name}`"
          v-model="formData[field.name]"
          :type="field.type"
          :autocomplete="field.autoComplete"
          :disabled="isLoading"
          :data-testid="`profile-${field.name}`"
        />
      </div>
    </div>

    <!-- Save button (hidden when parent controls submit externally) -->
    <Button
      v-if="!hideSubmitButton"
      type="submit"
      :disabled="isLoading"
      data-testid="profile-save"
    >
      {{ isLoading ? t('portal.account.saving') : t('portal.account.save') }}
    </Button>
  </form>
</template>
