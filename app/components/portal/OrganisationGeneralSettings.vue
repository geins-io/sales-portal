<script setup lang="ts">
import type { Company } from '#shared/types/company';

defineProps<{
  company: Company;
}>();

const { t } = useI18n();
</script>

<template>
  <div data-testid="organisation-general-settings" class="space-y-6">
    <!-- Company info fields -->
    <div
      class="border-border rounded-lg border bg-white p-6 shadow-sm"
      data-testid="organisation-info-panel"
    >
      <h2 class="mb-4 text-lg font-semibold">
        {{ t('portal.org.info.title') }}
      </h2>

      <dl class="space-y-4">
        <!-- Company name -->
        <div data-testid="org-field-name">
          <dt
            class="text-muted-foreground text-xs font-medium tracking-wider uppercase"
          >
            {{ t('portal.org.info.name') }}
          </dt>
          <dd class="mt-1 text-sm">{{ company.name ?? '-' }}</dd>
        </div>

        <!-- ID / Customer no -->
        <div data-testid="org-field-id">
          <dt
            class="text-muted-foreground text-xs font-medium tracking-wider uppercase"
          >
            {{ t('portal.org.info.id') }}
          </dt>
          <dd class="mt-1 text-sm">{{ company.id }}</dd>
        </div>

        <!-- VAT number -->
        <div data-testid="org-field-vat">
          <dt
            class="text-muted-foreground text-xs font-medium tracking-wider uppercase"
          >
            {{ t('portal.org.info.vat_number') }}
          </dt>
          <dd class="mt-1 text-sm">{{ company.vatNumber ?? '-' }}</dd>
        </div>

        <!-- Ex VAT -->
        <div data-testid="org-field-ex-vat">
          <dt
            class="text-muted-foreground text-xs font-medium tracking-wider uppercase"
          >
            {{ t('portal.org.info.ex_vat') }}
          </dt>
          <dd class="mt-1 text-sm">
            {{
              company.exVat ? t('portal.org.info.yes') : t('portal.org.info.no')
            }}
          </dd>
        </div>

        <!-- Limited product access -->
        <div data-testid="org-field-limited-access">
          <dt
            class="text-muted-foreground text-xs font-medium tracking-wider uppercase"
          >
            {{ t('portal.org.info.limited_product_access') }}
          </dt>
          <dd class="mt-1 text-sm">
            {{
              company.limitedProductAccess
                ? t('portal.org.info.yes')
                : t('portal.org.info.no')
            }}
          </dd>
        </div>
      </dl>
    </div>

    <!-- Addresses -->
    <div
      v-if="company.addresses && company.addresses.length > 0"
      data-testid="organisation-addresses"
      class="space-y-3"
    >
      <h3 class="text-base font-semibold">
        {{ t('portal.org.info.addresses') }}
      </h3>
      <AddressBlock
        v-for="addr in company.addresses"
        :key="addr.addressId"
        :label="addr.addressType ?? t('portal.org.info.address')"
        :address="addr"
      />
    </div>
  </div>
</template>
