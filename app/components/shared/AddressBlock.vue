<script setup lang="ts">
import { computed } from 'vue';
import type { QuoteAddress } from '#shared/types/quote';

const props = defineProps<{
  label: string;
  icon?: string;
  address: QuoteAddress;
}>();

const joinedName = computed(() =>
  [props.address?.firstName, props.address?.lastName].filter(Boolean).join(' '),
);

const zipCity = computed(() =>
  [props.address?.zip, props.address?.city].filter(Boolean).join(' '),
);
</script>

<template>
  <div
    :class="
      icon
        ? 'border-border flex items-start gap-3 rounded-lg border p-4'
        : 'border-border space-y-1 rounded-lg border p-4'
    "
  >
    <template v-if="icon">
      <Icon :name="icon" class="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <div class="space-y-1">
        <p
          class="text-muted-foreground text-xs font-medium tracking-wider uppercase"
        >
          {{ label }}
        </p>
        <p v-if="address?.company" class="text-sm font-medium">
          {{ address.company }}
        </p>
        <p v-if="joinedName" class="text-muted-foreground text-sm">
          {{ joinedName }}
        </p>
        <p v-if="address?.addressLine1" class="text-muted-foreground text-sm">
          {{ address.addressLine1 }}
        </p>
        <p v-if="address?.addressLine2" class="text-muted-foreground text-sm">
          {{ address.addressLine2 }}
        </p>
        <p v-if="address?.addressLine3" class="text-muted-foreground text-sm">
          {{ address.addressLine3 }}
        </p>
        <p v-if="zipCity" class="text-muted-foreground text-sm">
          {{ zipCity }}
        </p>
        <p v-if="address?.country" class="text-muted-foreground text-sm">
          {{ address.country }}
        </p>
      </div>
    </template>
    <template v-else>
      <p
        class="text-muted-foreground text-xs font-medium tracking-wider uppercase"
      >
        {{ label }}
      </p>
      <p v-if="address?.company" class="text-sm font-medium">
        {{ address.company }}
      </p>
      <p v-if="joinedName" class="text-muted-foreground text-sm">
        {{ joinedName }}
      </p>
      <p v-if="address?.addressLine1" class="text-muted-foreground text-sm">
        {{ address.addressLine1 }}
      </p>
      <p v-if="address?.addressLine2" class="text-muted-foreground text-sm">
        {{ address.addressLine2 }}
      </p>
      <p v-if="address?.addressLine3" class="text-muted-foreground text-sm">
        {{ address.addressLine3 }}
      </p>
      <p v-if="zipCity" class="text-muted-foreground text-sm">
        {{ zipCity }}
      </p>
      <p v-if="address?.country" class="text-muted-foreground text-sm">
        {{ address.country }}
      </p>
    </template>
  </div>
</template>
