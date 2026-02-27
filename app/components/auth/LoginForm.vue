<script setup lang="ts">
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Button } from '~/components/ui/button';
import { useAuthStore } from '~/stores/auth';

const emit = defineEmits<{
  success: [user: unknown];
}>();

const authStore = useAuthStore();

const email = ref('');
const password = ref('');

async function handleSubmit() {
  authStore.clearError();

  if (!email.value || !password.value) return;

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
    <!-- Error message -->
    <div
      v-if="authStore.error"
      data-testid="login-error"
      class="bg-destructive/10 text-destructive rounded-md p-3 text-sm"
    >
      {{ $t(authStore.error) }}
    </div>

    <!-- Email -->
    <div class="space-y-2">
      <Label for="login-email">{{ $t('auth.email') }}</Label>
      <Input
        id="login-email"
        v-model="email"
        type="email"
        :placeholder="$t('auth.email')"
        required
        autocomplete="email"
        :disabled="authStore.isLoading"
        data-testid="login-email"
      />
    </div>

    <!-- Password -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <Label for="login-password">{{ $t('auth.password') }}</Label>
        <span
          data-testid="login-forgot-password"
          class="text-muted-foreground cursor-not-allowed text-sm opacity-50"
          :title="$t('auth.forgot_password')"
        >
          {{ $t('auth.forgot_password') }}
        </span>
      </div>
      <Input
        id="login-password"
        v-model="password"
        type="password"
        :placeholder="$t('auth.password')"
        required
        autocomplete="current-password"
        :disabled="authStore.isLoading"
        data-testid="login-password"
      />
    </div>

    <!-- Submit -->
    <Button
      type="submit"
      class="w-full"
      :disabled="authStore.isLoading || !email || !password"
      data-testid="login-submit"
    >
      {{ authStore.isLoading ? $t('auth.signing_in') : $t('auth.sign_in') }}
    </Button>
  </form>
</template>
