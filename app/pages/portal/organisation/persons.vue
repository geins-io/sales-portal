<script setup lang="ts">
import type { Company } from '#shared/types/company';

definePageMeta({ middleware: 'auth' });

const { t } = useI18n();

useHead({
  title: computed(() => t('portal.org.persons.title')),
});

const { data, pending, error } = useFetch<{ company: Company }>(
  '/api/portal/company',
  { dedupe: 'defer' },
);

const buyers = computed(() => data.value?.company?.buyers ?? []);

watch(
  [pending, error],
  ([isPending, currentError]) => {
    if (isPending) return;
    if (
      currentError &&
      (currentError as { statusCode?: number }).statusCode === 404
    ) {
      throw createError({ statusCode: 404, fatal: true });
    }
  },
  { immediate: true },
);
</script>

<template>
  <PortalShell>
    <PortalOrganisationShell>
      <!-- Loading state -->
      <div
        v-if="pending"
        data-testid="organisation-loading"
        class="text-muted-foreground py-12 text-center text-sm"
      >
        {{ t('common.loading') }}
      </div>

      <!-- Error state -->
      <div
        v-else-if="error"
        data-testid="organisation-error"
        class="text-muted-foreground py-12 text-center text-sm"
      >
        {{ t('portal.org.error_loading') }}
      </div>

      <!-- Content -->
      <OrganisationPersonsTable v-else :buyers="buyers" />
    </PortalOrganisationShell>
  </PortalShell>
</template>
