<script setup lang="ts">
const { t } = useI18n();

useHead({
  title: computed(() => t('contact.title')),
});
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8 lg:px-8">
    <div class="md:flex md:gap-8">
      <!-- Sidebar -->
      <InfoPageSidebar
        active-path="/contact"
        class="mb-6 md:mb-0 md:w-64 md:shrink-0"
      />

      <!-- Content -->
      <div class="max-w-2xl min-w-0 flex-1">
        <div class="mb-8">
          <h1 class="text-3xl font-bold tracking-tight">
            {{ t('contact.title') }}
          </h1>
          <p class="text-muted-foreground mt-2 text-sm">
            {{ t('contact.subtitle') }}
          </p>
        </div>
        <div class="text-muted-foreground mb-8 space-y-1 text-sm">
          <p class="text-foreground font-semibold">
            {{ t('contact.company_name') }}
          </p>
          <p>{{ t('contact.company_address') }}</p>
          <p>{{ t('contact.company_postal') }}</p>
          <p>{{ t('contact.company_phone') }}</p>
          <p>{{ t('contact.company_email') }}</p>
        </div>
        <ContactForm />
      </div>
    </div>
  </div>
</template>
