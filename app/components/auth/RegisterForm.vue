<script setup lang="ts">
import { z } from 'zod';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Button } from '~/components/ui/button';
import { useAuthStore } from '~/stores/auth';

const { t } = useI18n();

const MIN_PASSWORD_LENGTH = 8;

interface RegisterField {
  name: string;
  type: 'text' | 'email' | 'password' | 'tel';
  label: string;
  placeholder?: string;
  required: boolean;
  autoComplete?: string;
}

const REGISTER_FIELDS: RegisterField[] = [
  {
    name: 'email',
    type: 'email',
    label: 'auth.email',
    required: true,
    autoComplete: 'email',
  },
  {
    name: 'password',
    type: 'password',
    label: 'auth.password',
    required: true,
    autoComplete: 'new-password',
  },
  {
    name: 'firstName',
    type: 'text',
    label: 'auth.first_name',
    required: true,
    autoComplete: 'given-name',
  },
  {
    name: 'lastName',
    type: 'text',
    label: 'auth.last_name',
    required: true,
    autoComplete: 'family-name',
  },
  {
    name: 'company',
    type: 'text',
    label: 'auth.company',
    required: true,
    autoComplete: 'organization',
  },
  {
    name: 'phone',
    type: 'tel',
    label: 'auth.phone',
    required: false,
    autoComplete: 'tel',
  },
];

const registerSchema = z.object({
  email: z.string().min(1, 'auth.field_required').email('auth.invalid_email'),
  password: z
    .string()
    .min(1, 'auth.field_required')
    .min(MIN_PASSWORD_LENGTH, 'auth.password_min_length'),
  firstName: z.string().min(1, 'auth.field_required'),
  lastName: z.string().min(1, 'auth.field_required'),
  company: z.string().min(1, 'auth.field_required'),
  phone: z.string().optional(),
});

const emit = defineEmits<{
  success: [user: unknown];
}>();

const authStore = useAuthStore();
const submitted = ref(false);

const formData = reactive<Record<string, string>>(
  Object.fromEntries(REGISTER_FIELDS.map((f) => [f.name, ''])),
);
const fieldErrors = reactive<Record<string, string>>({});
const touched = reactive<Record<string, boolean>>({});

function validateField(name: string) {
  const shape = registerSchema.shape[name as keyof typeof registerSchema.shape];
  if (!shape) return;
  const result = shape.safeParse(formData[name]);
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

function validateAll(): boolean {
  for (const field of REGISTER_FIELDS) {
    touched[field.name] = true;
    validateField(field.name);
  }
  return Object.values(fieldErrors).every((v) => !v);
}

function buildRegisterPayload() {
  return {
    username: formData.email!,
    password: formData.password!,
    user: {
      address: {
        firstName: formData.firstName || undefined,
        lastName: formData.lastName || undefined,
        company: formData.company || undefined,
        phone: formData.phone || undefined,
      },
    },
  };
}

async function handleSubmit() {
  authStore.clearError();
  if (!validateAll()) return;

  try {
    const payload = buildRegisterPayload();
    const user = await authStore.register(payload);

    if (user) {
      emit('success', user);
    } else {
      submitted.value = true;
    }
  } catch {
    // Error is already set in the store
  }
}
</script>

<template>
  <!-- Success state -->
  <div
    v-if="submitted"
    data-testid="register-success"
    class="space-y-3 py-4 text-center"
  >
    <div
      class="bg-primary/10 text-primary mx-auto flex size-12 items-center justify-center rounded-full"
    >
      <Icon name="lucide:check" class="size-6" />
    </div>
    <h3 class="text-lg font-semibold">{{ t('auth.register_success') }}</h3>
    <p class="text-muted-foreground text-sm">
      {{ t('auth.register_success_message') }}
    </p>
  </div>

  <!-- Registration form -->
  <form
    v-else
    data-testid="register-form"
    class="space-y-4"
    @submit.prevent="handleSubmit"
  >
    <!-- Store error message -->
    <div
      v-if="authStore.error"
      data-testid="register-error"
      class="bg-destructive/10 text-destructive rounded-md p-3 text-sm"
    >
      {{ t(authStore.error) }}
    </div>

    <!-- Dynamic fields -->
    <div v-for="field in REGISTER_FIELDS" :key="field.name" class="space-y-2">
      <Label :for="`register-${field.name}`">
        {{ t(field.label) }}
      </Label>
      <Input
        :id="`register-${field.name}`"
        v-model="formData[field.name]"
        :type="field.type"
        :placeholder="field.placeholder ? t(field.placeholder) : ''"
        :autocomplete="field.autoComplete"
        :disabled="authStore.isLoading"
        :data-testid="`register-${field.name}`"
        @blur="handleBlur(field.name)"
      />
      <p
        v-if="touched[field.name] && fieldErrors[field.name]"
        class="text-destructive text-xs"
        :data-testid="`register-${field.name}-error`"
      >
        {{ t(fieldErrors[field.name]!, { min: MIN_PASSWORD_LENGTH }) }}
      </p>
    </div>

    <!-- Submit -->
    <Button
      type="submit"
      class="w-full"
      :disabled="authStore.isLoading"
      data-testid="register-submit"
    >
      {{
        authStore.isLoading ? t('auth.submitting') : t('auth.apply_for_account')
      }}
    </Button>
  </form>
</template>
