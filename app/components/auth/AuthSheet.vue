<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';

const authStore = useAuthStore();
const { localePath } = useLocaleMarket();
const { hasFeature } = useTenant();
const router = useRouter();

const isOpen = computed({
  get: () => authStore.sheetOpen,
  set: (val: boolean) => {
    if (val) {
      authStore.sheetOpen = val;
    } else {
      authStore.closeSheet();
    }
  },
});

function handleSuccess() {
  authStore.closeSheet();
  authStore.sheetView = 'login';
}

function handleForgot() {
  authStore.sheetView = 'forgot';
}

function backToLogin() {
  authStore.sheetView = 'login';
}

function goToApply() {
  authStore.closeSheet();
  router.push(localePath('/apply-for-account'));
}

watch(
  () => authStore.sheetOpen,
  (open) => {
    if (open) authStore.clearError();
  },
);
</script>

<template>
  <Sheet v-model:open="isOpen">
    <SheetContent
      side="right"
      class="flex w-full flex-col gap-0 px-6 py-16 sm:max-w-md"
      data-testid="auth-sheet"
    >
      <SheetHeader class="gap-2 p-0">
        <SheetTitle class="text-2xl font-semibold tracking-tight">
          {{
            authStore.sheetView === 'forgot'
              ? $t('auth.forgot_password')
              : $t('auth.log_in')
          }}
        </SheetTitle>
        <SheetDescription class="text-muted-foreground text-sm">
          {{
            authStore.sheetView === 'forgot'
              ? $t('auth.forgot_subtitle')
              : $t('auth.login_subtitle')
          }}
        </SheetDescription>
      </SheetHeader>

      <div class="mt-6 flex-1 overflow-y-auto px-0.5">
        <template v-if="authStore.sheetView === 'login'">
          <LoginForm @success="handleSuccess" @forgot="handleForgot" />

          <template v-if="hasFeature('applyForAccount')">
            <div class="relative my-6">
              <Separator />
              <span
                class="text-muted-foreground bg-background absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 text-xs"
                data-testid="auth-sheet-divider"
              >
                {{ $t('auth.no_account') }}
              </span>
            </div>

            <p
              class="text-muted-foreground mb-4 text-sm"
              data-testid="auth-sheet-business-info"
            >
              {{ $t('auth.business_account_info') }}
            </p>

            <NuxtLink
              :to="localePath('/apply-for-account')"
              class="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-10 w-full items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors"
              data-testid="auth-sheet-apply"
              @click="goToApply"
            >
              {{ $t('auth.apply_for_account') }}
            </NuxtLink>
          </template>
        </template>

        <template v-else-if="authStore.sheetView === 'forgot'">
          <ForgotPasswordForm />
          <p class="mt-4 text-center text-sm">
            <Button
              variant="link"
              class="h-auto p-0"
              data-testid="auth-sheet-forgot-back"
              @click="backToLogin"
            >
              {{ $t('auth.forgot_back_to_login') }}
            </Button>
          </p>
        </template>
      </div>
    </SheetContent>
  </Sheet>
</template>
