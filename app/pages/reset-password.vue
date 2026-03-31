<script setup lang="ts">
import { Card, CardContent } from '~/components/ui/card';

definePageMeta({
  middleware: 'guest',
  layout: false,
});

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { localePath } = useLocaleMarket();

const resetKey = computed(() => (route.query.key as string) || '');

function handleSuccess() {
  // Auto-redirect to login after 3 seconds
  setTimeout(() => {
    router.replace(localePath('/login'));
  }, 3000);
}
</script>

<template>
  <div
    class="flex min-h-screen items-center justify-center px-4 py-12"
    data-testid="reset-password-page"
  >
    <Card class="w-full max-w-sm">
      <CardContent class="px-6 pt-8 pb-6">
        <!-- Header -->
        <div class="mb-6">
          <h1 class="text-xl font-semibold tracking-tight">
            {{ t('auth.reset_title') }}
          </h1>
          <p class="text-muted-foreground mt-1 text-sm">
            {{ t('auth.reset_subtitle') }}
          </p>
        </div>

        <ResetPasswordForm :reset-key="resetKey" @success="handleSuccess" />
      </CardContent>
    </Card>
  </div>
</template>
