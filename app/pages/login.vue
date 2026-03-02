<script setup lang="ts">
definePageMeta({
  middleware: 'guest',
  layout: false,
});

const route = useRoute();
const router = useRouter();

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
</script>

<template>
  <AuthCard :default-view="defaultView" @close="handleClose">
    <template #login>
      <AuthLoginForm @success="handleSuccess" />
    </template>
    <template #register>
      <AuthRegisterForm @success="handleSuccess" />
    </template>
  </AuthCard>
</template>
