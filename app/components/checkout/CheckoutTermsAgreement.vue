<script setup lang="ts">
import { Checkbox } from '~/components/ui/checkbox';
import { Label } from '~/components/ui/label';

defineProps<{
  modelValue: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const { t } = useI18n();
const { localePath } = useLocaleMarket();
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
      {{ t('auth.accept_terms_prefix') }}
      <NuxtLink
        :to="localePath('/terms')"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary underline underline-offset-2"
        data-testid="checkout-terms-link"
      >
        {{ t('auth.accept_terms_link_text') }}
      </NuxtLink>
    </Label>
  </div>
</template>
