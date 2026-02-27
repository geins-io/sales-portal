<script setup lang="ts">
import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';

const props = withDefaults(
  defineProps<{
    defaultView?: 'login' | 'register';
  }>(),
  { defaultView: 'login' },
);

const emit = defineEmits<{
  close: [];
}>();

const activeView = ref(props.defaultView);

function switchToRegister() {
  activeView.value = 'register';
}

function switchToLogin() {
  activeView.value = 'login';
}
</script>

<template>
  <div
    class="flex min-h-screen items-center justify-center px-4 py-12"
    data-testid="auth-card"
  >
    <Card class="relative w-full max-w-sm">
      <!-- Close button -->
      <button
        data-testid="auth-close"
        class="text-muted-foreground hover:text-foreground absolute top-4 right-4 rounded-sm opacity-70 transition-opacity hover:opacity-100"
        @click="emit('close')"
      >
        <Icon name="lucide:x" class="size-4" />
        <span class="sr-only">{{ $t('common.close') }}</span>
      </button>

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

        <!-- Register view -->
        <template v-else>
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
            <button
              class="text-primary hover:text-primary/80 font-medium underline underline-offset-4"
              @click="switchToLogin"
            >
              {{ $t('auth.sign_in') }}
            </button>
          </p>
        </template>
      </CardContent>
    </Card>
  </div>
</template>
