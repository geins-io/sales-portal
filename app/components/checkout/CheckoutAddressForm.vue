<script setup lang="ts">
import { z } from 'zod';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import type { AddressInputType } from '#shared/types/commerce';

const { t } = useI18n();

type AddressFieldName = Extract<keyof AddressInputType, string>;

interface AddressField {
  name: AddressFieldName;
  type: 'text' | 'tel';
  label: string;
  required: boolean;
  autoComplete?: string;
}

const ADDRESS_FIELDS: AddressField[] = [
  {
    name: 'firstName',
    type: 'text',
    label: 'checkout.first_name',
    required: true,
    autoComplete: 'given-name',
  },
  {
    name: 'lastName',
    type: 'text',
    label: 'checkout.last_name',
    required: true,
    autoComplete: 'family-name',
  },
  {
    name: 'company',
    type: 'text',
    label: 'checkout.company',
    required: false,
    autoComplete: 'organization',
  },
  {
    name: 'addressLine1',
    type: 'text',
    label: 'checkout.address_line_1',
    required: true,
    autoComplete: 'address-line1',
  },
  {
    name: 'addressLine2',
    type: 'text',
    label: 'checkout.address_line_2',
    required: false,
    autoComplete: 'address-line2',
  },
  {
    name: 'careOf',
    type: 'text',
    label: 'checkout.care_of',
    required: false,
  },
  {
    name: 'zip',
    type: 'text',
    label: 'checkout.zip',
    required: true,
    autoComplete: 'postal-code',
  },
  {
    name: 'city',
    type: 'text',
    label: 'checkout.city',
    required: true,
    autoComplete: 'address-level2',
  },
  {
    name: 'country',
    type: 'text',
    label: 'checkout.country',
    required: true,
    autoComplete: 'country-name',
  },
  {
    name: 'phone',
    type: 'tel',
    label: 'checkout.phone',
    required: false,
    autoComplete: 'tel',
  },
  {
    name: 'mobile',
    type: 'tel',
    label: 'checkout.mobile',
    required: false,
    autoComplete: 'tel',
  },
  {
    name: 'entryCode',
    type: 'text',
    label: 'checkout.entry_code',
    required: false,
  },
];

/** Client-side schema mirroring server/schemas/api-input.ts CheckoutAddressSchema */
const addressSchema = z.object({
  firstName: z.string().min(1, 'checkout.field_required').max(100),
  lastName: z.string().min(1, 'checkout.field_required').max(100),
  addressLine1: z.string().min(1, 'checkout.field_required').max(200),
  addressLine2: z.string().max(200).optional(),
  addressLine3: z.string().max(200).optional(),
  entryCode: z.string().max(50).optional(),
  careOf: z.string().max(200).optional(),
  city: z.string().min(1, 'checkout.field_required').max(100),
  state: z.string().max(100).optional(),
  country: z.string().min(1, 'checkout.field_required').max(100),
  zip: z.string().min(1, 'checkout.field_required').max(20),
  company: z.string().max(200).optional(),
  mobile: z.string().max(50).optional(),
  phone: z.string().max(50).optional(),
});

const props = withDefaults(
  defineProps<{
    modelValue: Partial<AddressInputType>;
    prefix: string;
    disabled?: boolean;
  }>(),
  { disabled: false },
);

const emit = defineEmits<{
  'update:modelValue': [value: Partial<AddressInputType>];
}>();

const formData = reactive<Record<string, string>>(
  Object.fromEntries(ADDRESS_FIELDS.map((f) => [f.name, ''])),
);
const fieldErrors = reactive<Record<string, string>>({});
const touched = reactive<Record<string, boolean>>({});

// Sync parent modelValue into local formData
watch(
  () => props.modelValue,
  (val) => {
    for (const field of ADDRESS_FIELDS) {
      const incoming = val?.[field.name];
      if (incoming !== undefined && incoming !== null) {
        formData[field.name] = String(incoming);
      }
    }
  },
  { immediate: true, deep: true },
);

function validateField(name: string) {
  const shape = addressSchema.shape[name as keyof typeof addressSchema.shape];
  if (!shape) return;
  const result = shape.safeParse(formData[name] ?? '');
  if (result.success) {
    fieldErrors[name] = '';
  } else {
    fieldErrors[name] = result.error.issues[0]!.message;
  }
}

function handleBlur(name: string) {
  touched[name] = true;
  validateField(name);
}

function handleInput(name: string, value: string) {
  formData[name] = value;
  if (touched[name]) {
    validateField(name);
  }
  emitUpdate();
}

function emitUpdate() {
  const address: Partial<AddressInputType> = {};
  for (const field of ADDRESS_FIELDS) {
    const val = formData[field.name];
    if (val) {
      (address as Record<string, string>)[field.name] = val;
    }
  }
  emit('update:modelValue', address);
}

function validate(): boolean {
  for (const field of ADDRESS_FIELDS) {
    touched[field.name] = true;
    validateField(field.name);
  }
  return Object.values(fieldErrors).every((v) => !v);
}

/** Grid layout helper: returns CSS class for paired fields */
function isGridRow(name: string): boolean {
  return (
    name === 'firstName' ||
    name === 'lastName' ||
    name === 'zip' ||
    name === 'city' ||
    name === 'phone' ||
    name === 'mobile'
  );
}

function isGridStart(name: string): boolean {
  return name === 'firstName' || name === 'zip' || name === 'phone';
}

defineExpose({ validate });
</script>

<template>
  <div :data-testid="`${prefix}-address-form`" class="space-y-4">
    <div class="grid grid-cols-2 gap-4">
      <template v-for="field in ADDRESS_FIELDS" :key="field.name">
        <div
          :class="['space-y-2', isGridRow(field.name) ? '' : 'col-span-2']"
          :style="isGridStart(field.name) ? 'grid-column-start: 1' : ''"
        >
          <Label :for="`${prefix}-${field.name}`">
            {{ t(field.label) }}
          </Label>
          <Input
            :id="`${prefix}-${field.name}`"
            :model-value="formData[field.name]"
            :type="field.type"
            :autocomplete="field.autoComplete"
            :disabled="disabled"
            :data-testid="`${prefix}-${field.name}`"
            @update:model-value="handleInput(field.name, $event as string)"
            @blur="handleBlur(field.name)"
          />
          <p
            v-if="touched[field.name] && fieldErrors[field.name]"
            class="text-destructive text-xs"
            :data-testid="`${prefix}-${field.name}-error`"
          >
            {{ t(fieldErrors[field.name]!) }}
          </p>
        </div>
      </template>
    </div>
  </div>
</template>
