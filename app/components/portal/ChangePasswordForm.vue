<script setup lang="ts">
import { z } from 'zod';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Button } from '~/components/ui/button';

const { t } = useI18n();

const MIN_PASSWORD_LENGTH = 8;

const isLoading = ref(false);
const successMessage = ref('');
const errorMessage = ref('');

const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const fieldErrors = reactive<Record<string, string>>({});
const touched = reactive<Record<string, boolean>>({});

const schema = z.object({
  currentPassword: z.string().min(1, 'portal.password.field_required'),
  newPassword: z
    .string()
    .min(1, 'portal.password.field_required')
    .min(MIN_PASSWORD_LENGTH, 'portal.password.min_length'),
  confirmPassword: z.string().min(1, 'portal.password.field_required'),
});

function validateField(
  field: 'currentPassword' | 'newPassword' | 'confirmPassword',
) {
  const values = {
    currentPassword: currentPassword.value,
    newPassword: newPassword.value,
    confirmPassword: confirmPassword.value,
  };

  const result = schema.shape[field].safeParse(values[field]);
  if (!result.success) {
    fieldErrors[field] = result.error.issues[0]!.message;
    return;
  }
  if (
    field === 'confirmPassword' &&
    newPassword.value !== confirmPassword.value
  ) {
    fieldErrors[field] = 'portal.password.mismatch';
    return;
  }
  fieldErrors[field] = '';
}

function handleBlur(
  field: 'currentPassword' | 'newPassword' | 'confirmPassword',
) {
  touched[field] = true;
  validateField(field);
}

function validateAll(): boolean {
  (['currentPassword', 'newPassword', 'confirmPassword'] as const).forEach(
    (f) => {
      touched[f] = true;
      validateField(f);
    },
  );
  return Object.values(fieldErrors).every((v) => !v);
}

async function handleSubmit() {
  successMessage.value = '';
  errorMessage.value = '';
  if (!validateAll()) return;

  isLoading.value = true;
  try {
    await $fetch('/api/user/change-password', {
      method: 'POST',
      body: {
        currentPassword: currentPassword.value,
        newPassword: newPassword.value,
      },
    });
    successMessage.value = t('portal.password.success');
    currentPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
    Object.keys(touched).forEach((k) => {
      touched[k] = false;
    });
  } catch {
    errorMessage.value = t('portal.password.error');
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <form
    data-testid="change-password-form"
    class="space-y-4"
    @submit.prevent="handleSubmit"
  >
    <!-- Success / Error -->
    <div
      v-if="successMessage"
      data-testid="password-success"
      class="bg-primary/10 text-primary rounded-md p-3 text-sm"
    >
      {{ successMessage }}
    </div>
    <div
      v-if="errorMessage"
      data-testid="password-error"
      class="bg-destructive/10 text-destructive rounded-md p-3 text-sm"
    >
      {{ errorMessage }}
    </div>

    <!-- Current password -->
    <div class="space-y-2">
      <Label for="password-current">{{ t('portal.password.current') }}</Label>
      <Input
        id="password-current"
        v-model="currentPassword"
        type="password"
        autocomplete="current-password"
        :disabled="isLoading"
        data-testid="password-current"
        @blur="handleBlur('currentPassword')"
      />
      <p
        v-if="touched.currentPassword && fieldErrors.currentPassword"
        class="text-destructive text-xs"
        data-testid="password-current-error"
      >
        {{ t(fieldErrors.currentPassword) }}
      </p>
    </div>

    <!-- New password -->
    <div class="space-y-2">
      <Label for="password-new">{{ t('portal.password.new') }}</Label>
      <Input
        id="password-new"
        v-model="newPassword"
        type="password"
        autocomplete="new-password"
        :disabled="isLoading"
        data-testid="password-new"
        @blur="handleBlur('newPassword')"
      />
      <p
        v-if="touched.newPassword && fieldErrors.newPassword"
        class="text-destructive text-xs"
        data-testid="password-new-error"
      >
        {{ t(fieldErrors.newPassword, { min: MIN_PASSWORD_LENGTH }) }}
      </p>
    </div>

    <!-- Confirm password -->
    <div class="space-y-2">
      <Label for="password-confirm">{{ t('portal.password.confirm') }}</Label>
      <Input
        id="password-confirm"
        v-model="confirmPassword"
        type="password"
        autocomplete="new-password"
        :disabled="isLoading"
        data-testid="password-confirm"
        @blur="handleBlur('confirmPassword')"
      />
      <p
        v-if="touched.confirmPassword && fieldErrors.confirmPassword"
        class="text-destructive text-xs"
        data-testid="password-confirm-error"
      >
        {{ t(fieldErrors.confirmPassword) }}
      </p>
    </div>

    <!-- Submit -->
    <Button type="submit" :disabled="isLoading" data-testid="password-submit">
      {{
        isLoading
          ? t('portal.password.submitting')
          : t('portal.password.submit')
      }}
    </Button>
  </form>
</template>
