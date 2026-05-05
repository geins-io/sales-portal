<script setup lang="ts">
/**
 * /account — catches the Geins Admin "Login As" redirect.
 *
 * Geins Admin navigates to: /account?loginToken=eyJhbG...
 * This page immediately redirects to the server endpoint that sets
 * auth cookies and redirects to /portal.
 *
 * If no loginToken is present, redirects to /login.
 */
definePageMeta({
  layout: false,
});

const route = useRoute();
const { localePath } = useLocaleMarket();
const loginToken = route.query.loginToken as string | undefined;

if (loginToken) {
  const redirect = (route.query.redirect as string) || '/portal';
  await navigateTo(
    `/api/auth/login-as?loginToken=${encodeURIComponent(loginToken)}&redirect=${encodeURIComponent(redirect)}`,
    { external: true },
  );
} else {
  await navigateTo(localePath('/login'), { replace: true });
}
</script>

<template>
  <div />
</template>
