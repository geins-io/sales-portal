<script setup lang="ts">
import { z } from 'zod';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Button } from '~/components/ui/button';
import { useAuthStore } from '~/stores/auth';

const { t } = useI18n();

const emit = defineEmits<{
  success: [user: unknown];
}>();

const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const fieldErrors = reactive<Record<string, string>>({});
const touched = reactive<Record<string, boolean>>({});

const loginSchema = z.object({
  email: z.string().min(1, 'auth.field_required').email('auth.invalid_email'),
  password: z.string().min(1, 'auth.field_required'),
});

function validateField(field: 'email' | 'password') {
  const value = field === 'email' ? email.value : password.value;
  const result = loginSchema.shape[field].safeParse(value);
  if (result.success) {
    fieldErrors[field] = '';
  } else {
    fieldErrors[field] = result.error.issues[0]!.message;
  }
}

function handleBlur(field: 'email' | 'password') {
  touched[field] = true;
  validateField(field);
}

function validateAll(): boolean {
  touched.email = true;
  touched.password = true;
  validateField('email');
  validateField('password');
  return Object.values(fieldErrors).every((v) => !v);
}

async function handleSubmit() {
  authStore.clearError();
  if (!validateAll()) return;

  try {
    const user = await authStore.login({
      username: email.value,
      password: password.value,
    });
    emit('success', user);
  } catch {
    // Error is already set in the store
  }
}
</script>

<template>
  <form
    data-testid="login-form"
    class="space-y-4"
    @submit.prevent="handleSubmit"
  >
    <!-- Store error message -->
    <div
      v-if="authStore.error"
      data-testid="login-error"
      class="bg-destructive/10 text-destructive rounded-md p-3 text-sm"
    >
      {{ t(authStore.error) }}
    </div>

    <!-- Email -->
    <div class="space-y-2">
      <Label for="login-email">{{ t('auth.email') }}</Label>
      <Input
        id="login-email"
        v-model="email"
        type="email"
        placeholder="m@example.com"
        autocomplete="email"
        :disabled="authStore.isLoading"
        data-testid="login-email"
        @blur="handleBlur('email')"
      />
      <p
        v-if="touched.email && fieldErrors.email"
        class="text-destructive text-xs"
        data-testid="login-email-error"
      >
        {{ t(fieldErrors.email) }}
      </p>
    </div>

    <!-- Password -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <Label for="login-password">{{ t('auth.password') }}</Label>
        <span
          data-testid="login-forgot-password"
          class="text-muted-foreground cursor-not-allowed text-sm opacity-50"
        >
          {{ t('auth.forgot_password') }}
        </span>
      </div>
      <Input
        id="login-password"
        v-model="password"
        type="password"
        autocomplete="current-password"
        :disabled="authStore.isLoading"
        data-testid="login-password"
        @blur="handleBlur('password')"
      />
      <p
        v-if="touched.password && fieldErrors.password"
        class="text-destructive text-xs"
        data-testid="login-password-error"
      >
        {{ t(fieldErrors.password) }}
      </p>
    </div>

    <!-- Submit -->
    <Button
      type="submit"
      class="w-full"
      :disabled="authStore.isLoading"
      data-testid="login-submit"
    >
      {{ authStore.isLoading ? t('auth.signing_in') : t('auth.log_in') }}
    </Button>
  </form>
</template>
