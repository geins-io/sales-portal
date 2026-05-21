<script setup lang="ts">
const { t } = useI18n();
const { localePath } = useLocaleMarket();
const { isCatalogMode } = useTenant();
const { canAccess } = useFeatureAccess();

if (isCatalogMode.value || !canAccess('cart')) {
  await navigateTo(localePath('/'), { replace: true });
}

useHead({
  title: computed(() => t('cart.shopping_cart')),
});
</script>

<template>
  <CartPage />
</template>
