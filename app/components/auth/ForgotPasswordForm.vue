<script setup lang="ts">
import { z } from 'zod';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Button } from '~/components/ui/button';
import { useAuthStore } from '~/stores/auth';

const { t } = useI18n();

const emit = defineEmits<{
  success: [];
}>();

const authStore = useAuthStore();

const email = ref('');
const fieldErrors = reactive<Record<string, string>>({});
const touched = reactive<Record<string, boolean>>({});
const submitted = ref(false);

const forgotSchema = z.object({
  email: z.string().min(1, 'auth.field_required').email('auth.invalid_email'),
});

function validateField() {
  const result = forgotSchema.shape.email.safeParse(email.value);
  if (result.success) {
    fieldErrors.email = '';
  } else {
    fieldErrors.email = result.error.issues[0]!.message;
  }
}

function handleBlur() {
  touched.email = true;
  validateField();
}

function validateAll(): boolean {
  touched.email = true;
  validateField();
  return !fieldErrors.email;
}

async function handleSubmit() {
  authStore.clearError();
  if (!validateAll()) return;

  try {
    await authStore.requestPasswordReset(email.value);
    submitted.value = true;
    emit('success');
  } catch {
    // Still show success to prevent email enumeration
    submitted.value = true;
    emit('success');
  }
}
</script>

<template>
  <!-- Success state -->
  <div
    v-if="submitted"
    data-testid="forgot-success"
    class="space-y-3 py-4 text-center"
  >
    <div
      class="bg-primary/10 text-primary mx-auto flex size-12 items-center justify-center rounded-full"
    >
      <Icon name="lucide:mail" class="size-6" />
    </div>
    <h3 class="text-lg font-semibold">{{ t('auth.forgot_success') }}</h3>
    <p class="text-muted-foreground text-sm">
      {{ t('auth.forgot_success_message') }}
    </p>
  </div>

  <!-- Forgot password form -->
  <form
    v-else
    data-testid="forgot-form"
    class="space-y-4"
    @submit.prevent="handleSubmit"
  >
    <p class="text-muted-foreground text-sm">
      {{ t('auth.forgot_subtitle') }}
    </p>

    <!-- Email -->
    <div class="space-y-2">
      <Label for="forgot-email">{{ t('auth.email') }}</Label>
      <Input
        id="forgot-email"
        v-model="email"
        type="email"
        :placeholder="t('auth.forgot_enter_email')"
        autocomplete="email"
        :disabled="authStore.isLoading"
        data-testid="forgot-email"
        @blur="handleBlur"
      />
      <p
        v-if="touched.email && fieldErrors.email"
        class="text-destructive text-xs"
        data-testid="forgot-email-error"
      >
        {{ t(fieldErrors.email) }}
      </p>
    </div>

    <!-- Submit -->
    <Button
      type="submit"
      class="w-full"
      :disabled="authStore.isLoading"
      data-testid="forgot-submit"
    >
      {{ authStore.isLoading ? t('auth.forgot_sending') : t('auth.forgot_submit') }}
    </Button>
  </form>
</template>
