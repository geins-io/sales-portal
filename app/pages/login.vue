<script setup lang="ts">
import { isSafeInternalPath } from '#shared/utils/redirect';

definePageMeta({
  middleware: 'guest',
  layout: false,
});

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { localePath } = useLocaleMarket();
const { features } = useTenant();

useHead({
  title: computed(() => t('auth.log_in')),
});

const authCardRef = ref<{ switchToForgot: () => void } | null>(null);

const registrationEnabled = computed(
  () => features.value?.registration?.enabled ?? true,
);

const defaultView = computed(() =>
  route.query.tab === 'register' && registrationEnabled.value
    ? ('register' as const)
    : ('login' as const),
);

function handleSuccess() {
  const raw = route.query.redirect;
  const redirect = isSafeInternalPath(raw) ? raw : localePath('/');
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
