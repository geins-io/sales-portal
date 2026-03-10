<script setup lang="ts">
const { t } = useI18n();

useHead({
  title: computed(() => t('contact.title')),
});
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-8 lg:px-8">
    <div class="mb-8 text-center">
      <h1 class="text-3xl font-bold tracking-tight">
        {{ t('contact.title') }}
      </h1>
      <p class="text-muted-foreground mt-2 text-sm">
        {{ t('contact.subtitle') }}
      </p>
    </div>
    <ContactContactForm />
  </div>
</template>
