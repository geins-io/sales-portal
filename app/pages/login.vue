<script lang="ts">
/**
 * Validates that a redirect path is safe (relative, no open-redirect).
 * Must start with `/` and must not contain `://` or `//`.
 */
export function isValidRedirect(path: unknown): boolean {
  if (typeof path !== 'string' || !path) return false;
  if (!path.startsWith('/')) return false;
  if (path.includes('://') || path.includes('//')) return false;
  return true;
}
</script>

<script setup lang="ts">
definePageMeta({
  middleware: 'guest',
  layout: false,
});

const route = useRoute();
const router = useRouter();
const { localePath } = useLocaleMarket();

const authCardRef = ref<{ switchToForgot: () => void } | null>(null);

const defaultView = computed(() =>
  route.query.tab === 'register' ? ('register' as const) : ('login' as const),
);

function handleSuccess() {
  const raw = route.query.redirect as string | undefined;
  const redirect = isValidRedirect(raw) ? raw! : localePath('/');
  router.replace(redirect);
}

function handleClose() {
  router.replace(localePath('/'));
}

function handleForgot() {
  authCardRef.value?.switchToForgot();
}
</script>

<template>
  <AuthCard ref="authCardRef" :default-view="defaultView" @close="handleClose">
    <template #login>
      <LoginForm @success="handleSuccess" @forgot="handleForgot" />
    </template>
    <template #register>
      <RegisterForm @success="handleSuccess" />
    </template>
    <template #forgot>
      <ForgotPasswordForm />
    </template>
  </AuthCard>
</template>
