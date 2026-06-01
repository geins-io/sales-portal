<script setup lang="ts">
definePageMeta({ middleware: 'feature', feature: 'orderPlacement' });

const { t } = useI18n();
const { localePath } = useLocaleMarket();
const { isCatalogMode } = useTenant();

if (isCatalogMode.value) {
  await navigateTo(localePath('/'), { replace: true });
}

useHead({
  title: computed(() => t('cart.shopping_cart')),
});
</script>

<template>
  <CartPage />
</template>
