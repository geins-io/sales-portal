<script setup lang="ts">
import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import { useTenant } from '~/composables/useTenant';

const props = withDefaults(
  defineProps<{
    defaultView?: 'login' | 'register' | 'forgot';
  }>(),
  { defaultView: 'login' },
);

const emit = defineEmits<{
  close: [];
}>();

const { features } = useTenant();

// Fail-open: missing key, missing features map, or missing tenant all default
// to enabled. Only an explicit `registration.enabled === false` disables.
const registrationEnabled = computed(
  () => features.value?.registration?.enabled ?? true,
);

const activeView = ref(props.defaultView);

watchEffect(() => {
  if (!registrationEnabled.value && activeView.value === 'register') {
    activeView.value = 'login';
  }
});

function switchToRegister() {
  activeView.value = 'register';
}

function switchToLogin() {
  activeView.value = 'login';
}

function switchToForgot() {
  activeView.value = 'forgot';
}

defineExpose({ switchToForgot });
</script>

<template>
  <div
    class="flex min-h-screen items-center justify-center px-4 py-12"
    data-testid="auth-card"
  >
    <Card class="relative w-full max-w-sm">
      <!-- Close button -->
      <Button
        variant="ghost"
        size="icon-sm"
        data-testid="auth-close"
        class="absolute top-4 right-4 opacity-70 hover:opacity-100"
        @click="emit('close')"
      >
        <Icon name="lucide:x" class="size-4" />
        <span class="sr-only">{{ $t('common.close') }}</span>
      </Button>

      <CardContent class="px-6 pt-8 pb-6">
        <!-- Login view -->
        <template v-if="activeView === 'login'">
          <!-- Header -->
          <div class="mb-6">
            <h1 class="text-xl font-semibold tracking-tight">
              {{ $t('auth.log_in') }}
            </h1>
            <p class="text-muted-foreground mt-1 text-sm">
              {{ $t('auth.login_subtitle') }}
            </p>
          </div>

          <!-- Login form slot -->
          <slot name="login" />

          <template v-if="registrationEnabled">
            <!-- Divider -->
            <div class="relative my-6">
              <Separator />
              <span
                class="text-muted-foreground bg-card absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 text-xs"
                data-testid="auth-divider"
              >
                {{ $t('auth.no_account') }}
              </span>
            </div>

            <!-- Business account info -->
            <p
              class="text-muted-foreground mb-4 text-sm"
              data-testid="auth-business-info"
            >
              {{ $t('auth.business_account_info') }}
            </p>

            <!-- Apply for account button -->
            <Button
              variant="outline"
              class="w-full"
              data-testid="auth-apply-button"
              @click="switchToRegister"
            >
              {{ $t('auth.apply_for_account') }}
            </Button>
          </template>
        </template>

        <!-- Register view -->
        <template v-else-if="activeView === 'register'">
          <!-- Header -->
          <div class="mb-6">
            <h1 class="text-xl font-semibold tracking-tight">
              {{ $t('auth.apply_for_account') }}
            </h1>
            <p class="text-muted-foreground mt-1 text-sm">
              {{ $t('auth.register_subtitle') }}
            </p>
          </div>

          <!-- Register form slot -->
          <slot name="register" />

          <!-- Back to login -->
          <p class="mt-4 text-center text-sm" data-testid="auth-back-to-login">
            <span class="text-muted-foreground">
              {{ $t('auth.already_have_account') }}
            </span>
            {{ ' ' }}
            <Button variant="link" class="h-auto p-0" @click="switchToLogin">
              {{ $t('auth.sign_in') }}
            </Button>
          </p>
        </template>

        <!-- Forgot password view -->
        <template v-else-if="activeView === 'forgot'">
          <!-- Header -->
          <div class="mb-6">
            <h1 class="text-xl font-semibold tracking-tight">
              {{ $t('auth.forgot_password') }}
            </h1>
          </div>

          <!-- Forgot password form slot -->
          <slot name="forgot" />

          <!-- Back to login -->
          <p
            class="mt-4 text-center text-sm"
            data-testid="auth-forgot-back-to-login"
          >
            <Button variant="link" class="h-auto p-0" @click="switchToLogin">
              {{ $t('auth.forgot_back_to_login') }}
            </Button>
          </p>
        </template>
      </CardContent>
    </Card>
  </div>
</template>
