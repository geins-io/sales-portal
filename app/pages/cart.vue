<script setup lang="ts">
const { t } = useI18n();

useHead({
  title: computed(() => t('cart.shopping_cart')),
});
</script>

<template>
  <CartPage />
</template>
