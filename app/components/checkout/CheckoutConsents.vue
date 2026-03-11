<script setup lang="ts">
import type { ConsentType } from '#shared/types/commerce';
import { Checkbox } from '~/components/ui/checkbox';
import { Label } from '~/components/ui/label';

const props = defineProps<{
  consents: ConsentType[];
  accepted: string[];
  disabled: boolean;
}>();

const emit = defineEmits<{
  toggle: [consentType: string];
}>();

const visibleConsents = computed(() =>
  props.consents.filter((c) => !c.autoAccept),
);
</script>

<template>
  <div data-testid="checkout-consents">
    <div v-if="visibleConsents.length" class="space-y-3">
      <div
        v-for="consent in visibleConsents"
        :key="consent.type"
        :data-testid="`consent-${consent.type}`"
        class="flex items-start gap-3"
      >
        <Checkbox
          :id="`consent-${consent.type}`"
          :checked="props.accepted.includes(consent.type!)"
          :disabled="props.disabled"
          @update:checked="emit('toggle', consent.type!)"
        />
        <div class="space-y-1">
          <Label :for="`consent-${consent.type}`" class="text-sm font-medium">
            {{ consent.name }}
          </Label>
          <p v-if="consent.description" class="text-muted-foreground text-xs">
            {{ consent.description }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
