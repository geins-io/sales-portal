<script setup lang="ts">
import { z } from 'zod';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Button } from '~/components/ui/button';
import { useAuthStore } from '~/stores/auth';

const { t } = useI18n();
const { localePath } = useLocaleMarket();

const MIN_PASSWORD_LENGTH = 8;

const props = defineProps<{
  resetKey: string;
}>();

const emit = defineEmits<{
  success: [];
}>();

const authStore = useAuthStore();

const password = ref('');
const confirmPassword = ref('');
const fieldErrors = reactive<Record<string, string>>({});
const touched = reactive<Record<string, boolean>>({});
const submitted = ref(false);

const resetSchema = z.object({
  password: z
    .string()
    .min(1, 'auth.field_required')
    .min(MIN_PASSWORD_LENGTH, 'auth.password_min_length'),
  confirmPassword: z.string().min(1, 'auth.field_required'),
});

function validateField(field: 'password' | 'confirmPassword') {
  const value = field === 'password' ? password.value : confirmPassword.value;
  const result = resetSchema.shape[field].safeParse(value);
  if (!result.success) {
    fieldErrors[field] = result.error.issues[0]!.message;
    return;
  }
  if (field === 'confirmPassword' && password.value !== confirmPassword.value) {
    fieldErrors[field] = 'auth.reset_passwords_must_match';
    return;
  }
  fieldErrors[field] = '';
}

function handleBlur(field: 'password' | 'confirmPassword') {
  touched[field] = true;
  validateField(field);
}

function validateAll(): boolean {
  touched.password = true;
  touched.confirmPassword = true;
  validateField('password');
  validateField('confirmPassword');
  return Object.values(fieldErrors).every((v) => !v);
}

async function handleSubmit() {
  authStore.clearError();
  if (!validateAll()) return;

  try {
    await authStore.resetPassword(props.resetKey, password.value);
    submitted.value = true;
    emit('success');
  } catch {
    // Error is already set in the store
  }
}
</script>

<template>
  <!-- Invalid/missing key -->
  <div
    v-if="!resetKey"
    data-testid="reset-invalid-key"
    class="space-y-3 py-4 text-center"
  >
    <div
      class="bg-destructive/10 text-destructive mx-auto flex size-12 items-center justify-center rounded-full"
    >
      <Icon name="lucide:alert-circle" class="size-6" />
    </div>
    <h3 class="text-lg font-semibold">{{ t('auth.reset_invalid_key') }}</h3>
    <NuxtLink
      :to="localePath('/login')"
      class="text-primary hover:text-primary/80 text-sm font-medium underline underline-offset-4"
      data-testid="reset-request-new"
    >
      {{ t('auth.reset_request_new') }}
    </NuxtLink>
  </div>

  <!-- Success state -->
  <div
    v-else-if="submitted"
    data-testid="reset-success"
    class="space-y-3 py-4 text-center"
  >
    <div
      class="bg-primary/10 text-primary mx-auto flex size-12 items-center justify-center rounded-full"
    >
      <Icon name="lucide:check" class="size-6" />
    </div>
    <h3 class="text-lg font-semibold">{{ t('auth.reset_success') }}</h3>
    <p class="text-muted-foreground text-sm">
      {{ t('auth.reset_success_message') }}
    </p>
  </div>

  <!-- Reset password form -->
  <form
    v-else
    data-testid="reset-form"
    class="space-y-4"
    @submit.prevent="handleSubmit"
  >
    <!-- Store error message -->
    <div
      v-if="authStore.error"
      data-testid="reset-error"
      class="bg-destructive/10 text-destructive rounded-md p-3 text-sm"
    >
      {{ t(authStore.error) }}
    </div>

    <!-- New password -->
    <div class="space-y-2">
      <Label for="reset-password">{{ t('auth.reset_new_password') }}</Label>
      <Input
        id="reset-password"
        v-model="password"
        type="password"
        autocomplete="new-password"
        :disabled="authStore.isLoading"
        data-testid="reset-password"
        @blur="handleBlur('password')"
      />
      <p
        v-if="touched.password && fieldErrors.password"
        class="text-destructive text-xs"
        data-testid="reset-password-error"
      >
        {{ t(fieldErrors.password, { min: MIN_PASSWORD_LENGTH }) }}
      </p>
    </div>

    <!-- Confirm password -->
    <div class="space-y-2">
      <Label for="reset-confirm-password">{{
        t('auth.reset_confirm_password')
      }}</Label>
      <Input
        id="reset-confirm-password"
        v-model="confirmPassword"
        type="password"
        autocomplete="new-password"
        :disabled="authStore.isLoading"
        data-testid="reset-confirm-password"
        @blur="handleBlur('confirmPassword')"
      />
      <p
        v-if="touched.confirmPassword && fieldErrors.confirmPassword"
        class="text-destructive text-xs"
        data-testid="reset-confirm-password-error"
      >
        {{ t(fieldErrors.confirmPassword) }}
      </p>
    </div>

    <!-- Submit -->
    <Button
      type="submit"
      class="w-full"
      :disabled="authStore.isLoading"
      data-testid="reset-submit"
    >
      {{
        authStore.isLoading ? t('auth.reset_resetting') : t('auth.reset_submit')
      }}
    </Button>
  </form>
</template>
