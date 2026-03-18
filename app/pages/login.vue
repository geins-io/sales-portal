<script setup lang="ts">
definePageMeta({
  middleware: 'guest',
  layout: false,
});

const route = useRoute();
const router = useRouter();

const authCardRef = ref<{ switchToForgot: () => void } | null>(null);

const defaultView = computed(() =>
  route.query.tab === 'register' ? ('register' as const) : ('login' as const),
);

function handleSuccess() {
  const redirect = (route.query.redirect as string) || '/';
  router.replace(redirect);
}

function handleClose() {
  router.replace('/');
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
