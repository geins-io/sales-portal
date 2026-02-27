<script setup lang="ts">
definePageMeta({
  middleware: 'guest',
  layout: false,
});

const route = useRoute();
const router = useRouter();

const defaultTab = computed(() =>
  route.query.tab === 'register' ? 'register' : 'login',
);

function handleSuccess() {
  const redirect = (route.query.redirect as string) || '/';
  router.replace(redirect);
}
</script>

<template>
  <AuthCard :default-tab="defaultTab">
    <template #login>
      <LoginForm @success="handleSuccess" />
    </template>
    <template #register>
      <RegisterForm @success="handleSuccess" />
    </template>
  </AuthCard>
</template>
