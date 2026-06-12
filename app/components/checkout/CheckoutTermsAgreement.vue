<script setup lang="ts">
import { Checkbox } from '~/components/ui/checkbox';
import { Label } from '~/components/ui/label';
import { CMS_TAGS } from '#shared/constants/cms';

defineProps<{
  modelValue: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const { t } = useI18n();
// Resolve the terms page link by tag so it follows the merchant's localized
// slug (e.g. "villkor" in SV) instead of a hardcoded "/terms" that 404s. When
// no terms page is tagged the link text still renders as plain text so the
// accept-checkbox stays usable.
const { to: termsTo, isResolved: termsResolved } = useCmsPageLink(
  CMS_TAGS.TERMS_PAGE,
);
</script>

<template>
  <div data-testid="checkout-terms" class="flex items-start gap-3">
    <Checkbox
      id="checkout-terms-checkbox"
      :model-value="modelValue"
      :disabled="disabled"
      @update:model-value="(v) => emit('update:modelValue', v === true)"
    />
    <Label
      for="checkout-terms-checkbox"
      class="cursor-pointer text-sm leading-relaxed select-none"
    >
      {{ t('checkout.terms_prefix') }}
      <NuxtLink
        v-if="termsResolved"
        :to="termsTo"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary underline underline-offset-2"
        data-testid="checkout-terms-link"
      >
        {{ t('checkout.terms_link_text') }}
      </NuxtLink>
      <span v-else>{{ t('checkout.terms_link_text') }}</span>
    </Label>
  </div>
</template>
