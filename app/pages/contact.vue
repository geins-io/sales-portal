<script setup lang="ts">
import { computed } from 'vue';

const { t } = useI18n();
const { contact } = useTenant();

useHead({
  title: computed(() => t('contact.title')),
});

// Each row prefers the structured tenant value, falling back to the existing
// i18n key when the tenant value is null. When neither exists the row is
// omitted (currently every row has an i18n fallback so they always render).
const addressLine = computed(
  () => contact.value?.address?.street ?? t('contact.company_address'),
);

const cityLine = computed(() => {
  const postal = contact.value?.address?.postalCode ?? null;
  const city = contact.value?.address?.city ?? null;
  if (postal && city) return `${postal} ${city}`;
  if (postal || city) return postal ?? city;
  return t('contact.company_postal');
});

const country = computed(() => contact.value?.address?.country ?? null);
const phoneLine = computed(
  () => contact.value?.phone ?? t('contact.company_phone'),
);
const emailLine = computed(
  () => contact.value?.email ?? t('contact.company_email'),
);
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8 lg:px-6">
    <div class="md:flex md:gap-8">
      <!-- Sidebar -->
      <InfoPageSidebar
        active-path="/contact"
        class="mb-6 md:mb-0 md:w-56 md:shrink-0"
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
          <p data-testid="contact-address">{{ addressLine }}</p>
          <p data-testid="contact-city">{{ cityLine }}</p>
          <p v-if="country" data-testid="contact-country">{{ country }}</p>
          <p data-testid="contact-phone">{{ phoneLine }}</p>
          <p data-testid="contact-email">{{ emailLine }}</p>
        </div>
        <ContactForm />
      </div>
    </div>
  </div>
</template>
