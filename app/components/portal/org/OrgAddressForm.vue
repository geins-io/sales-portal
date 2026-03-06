<script setup lang="ts">
import type { OrgAddress, ShippingAddress } from '#shared/types/b2b';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';

const { t } = useI18n();

const props = defineProps<{
  address?: OrgAddress;
}>();

const emit = defineEmits<{
  saved: [address: OrgAddress];
  cancel: [];
}>();

const isNew = computed(() => !props.address);
const isLoading = ref(false);
const errorMessage = ref('');

const formData = reactive<{
  label: string;
  isDefault: boolean;
  firstName: string;
  lastName: string;
  company: string;
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  postalCode: string;
  city: string;
  state: string;
  country: string;
  phone: string;
}>({
  label: props.address?.label ?? '',
  isDefault: props.address?.isDefault ?? false,
  firstName: props.address?.address.firstName ?? '',
  lastName: props.address?.address.lastName ?? '',
  company: props.address?.address.company ?? '',
  addressLine1: props.address?.address.addressLine1 ?? '',
  addressLine2: props.address?.address.addressLine2 ?? '',
  addressLine3: props.address?.address.addressLine3 ?? '',
  postalCode: props.address?.address.postalCode ?? '',
  city: props.address?.address.city ?? '',
  state: props.address?.address.state ?? '',
  country: props.address?.address.country ?? '',
  phone: props.address?.address.phone ?? '',
});

interface AddressField {
  name: keyof typeof formData;
  label: string;
  type: string;
  required?: boolean;
  halfWidth?: boolean;
}

const fields: AddressField[] = [
  {
    name: 'label',
    label: 'portal.org.addresses.label',
    type: 'text',
    required: true,
  },
  {
    name: 'firstName',
    label: 'portal.org.addresses.first_name',
    type: 'text',
    halfWidth: true,
  },
  {
    name: 'lastName',
    label: 'portal.org.addresses.last_name',
    type: 'text',
    halfWidth: true,
  },
  { name: 'company', label: 'portal.org.addresses.company', type: 'text' },
  {
    name: 'addressLine1',
    label: 'portal.org.addresses.address_line_1',
    type: 'text',
    required: true,
  },
  {
    name: 'addressLine2',
    label: 'portal.org.addresses.address_line_2',
    type: 'text',
  },
  {
    name: 'addressLine3',
    label: 'portal.org.addresses.address_line_3',
    type: 'text',
  },
  {
    name: 'postalCode',
    label: 'portal.org.addresses.postal_code',
    type: 'text',
    required: true,
    halfWidth: true,
  },
  {
    name: 'city',
    label: 'portal.org.addresses.city',
    type: 'text',
    required: true,
    halfWidth: true,
  },
  {
    name: 'state',
    label: 'portal.org.addresses.state',
    type: 'text',
    halfWidth: true,
  },
  {
    name: 'country',
    label: 'portal.org.addresses.country',
    type: 'text',
    required: true,
    halfWidth: true,
  },
  {
    name: 'phone',
    label: 'portal.org.addresses.phone',
    type: 'tel',
    halfWidth: true,
  },
];

async function handleSubmit() {
  isLoading.value = true;
  errorMessage.value = '';

  const shippingAddress: ShippingAddress = {
    addressLine1: formData.addressLine1,
    postalCode: formData.postalCode,
    city: formData.city,
    country: formData.country,
    ...(formData.firstName && { firstName: formData.firstName }),
    ...(formData.lastName && { lastName: formData.lastName }),
    ...(formData.company && { company: formData.company }),
    ...(formData.addressLine2 && { addressLine2: formData.addressLine2 }),
    ...(formData.addressLine3 && { addressLine3: formData.addressLine3 }),
    ...(formData.state && { state: formData.state }),
    ...(formData.phone && { phone: formData.phone }),
  };

  const body = {
    label: formData.label,
    isDefault: formData.isDefault,
    address: shippingAddress,
  };

  try {
    if (isNew.value) {
      const result = await $fetch<{ address: OrgAddress }>(
        '/api/organization/addresses',
        { method: 'POST', body },
      );
      emit('saved', result.address);
    } else {
      const result = await $fetch<{ address: OrgAddress }>(
        `/api/organization/addresses/${props.address!.id}`,
        { method: 'PATCH', body },
      );
      emit('saved', result.address);
    }
  } catch {
    errorMessage.value = t('portal.org.addresses.save_error');
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div
    data-testid="org-address-form"
    class="border-border rounded-lg border p-6"
  >
    <h4 class="mb-4 text-base font-semibold">
      {{
        isNew
          ? t('portal.org.addresses.add_title')
          : t('portal.org.addresses.edit_title')
      }}
    </h4>

    <div
      v-if="errorMessage"
      data-testid="address-form-error"
      class="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm"
    >
      {{ errorMessage }}
    </div>

    <form
      data-testid="address-form"
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
          <Label :for="`addr-${field.name}`">
            {{ t(field.label) }}
            <span v-if="field.required" class="text-destructive">*</span>
          </Label>
          <Input
            :id="`addr-${field.name}`"
            v-model="formData[field.name] as string"
            :type="field.type"
            :required="field.required"
            :disabled="isLoading"
            :data-testid="`addr-input-${field.name}`"
          />
        </div>
      </div>

      <div class="flex items-center gap-2">
        <Checkbox
          id="addr-isDefault"
          :checked="formData.isDefault"
          :disabled="isLoading"
          data-testid="addr-input-isDefault"
          @update:checked="formData.isDefault = $event as boolean"
        />
        <Label for="addr-isDefault">
          {{ t('portal.org.addresses.set_default') }}
        </Label>
      </div>

      <div class="flex gap-2">
        <Button type="submit" :disabled="isLoading" data-testid="address-save">
          {{
            isLoading
              ? t('portal.org.addresses.saving')
              : t('portal.org.addresses.save')
          }}
        </Button>
        <Button
          type="button"
          variant="outline"
          :disabled="isLoading"
          data-testid="address-cancel"
          @click="emit('cancel')"
        >
          {{ t('common.cancel') }}
        </Button>
      </div>
    </form>
  </div>
</template>
