<script setup lang="ts">
import { computed } from 'vue';
import type { FunctionalComponent } from 'vue';
import type { QuoteAddress } from '#shared/types/quote';
import type { CompanyAddress } from '#shared/types/company';

const props = defineProps<{
  label: string;
  icon?: FunctionalComponent;
  address: QuoteAddress | CompanyAddress;
  bare?: boolean;
  /**
   * Label style. `compact` (default) renders a small uppercase muted label
   * suited to dense card layouts; `header` renders a dark sentence-case
   * heading suited to inline detail sections where the label is the
   * section title.
   */
  labelStyle?: 'compact' | 'header';
  /**
   * Render the company line in the muted body style rather than as a bold
   * primary line. Used where the layout already has a section heading
   * carrying the prominence.
   */
  companyMuted?: boolean;
}>();

const labelClass = computed(() =>
  props.labelStyle === 'header'
    ? 'text-foreground text-sm font-semibold'
    : 'text-muted-foreground text-xs font-medium tracking-wider uppercase',
);

const companyClass = computed(() =>
  props.companyMuted ? 'text-muted-foreground text-sm' : 'text-sm font-medium',
);

const containerClass = computed(() => {
  if (props.bare) {
    return props.icon ? 'flex items-start gap-3' : 'space-y-1';
  }
  return props.icon
    ? 'border-border flex items-start gap-3 rounded-lg border p-4'
    : 'border-border space-y-1 rounded-lg border p-4';
});

const joinedName = computed(() =>
  [props.address?.firstName, props.address?.lastName].filter(Boolean).join(' '),
);

const zipCity = computed(() =>
  [props.address?.zip, props.address?.city].filter(Boolean).join(' '),
);
</script>

<template>
  <div :class="containerClass">
    <template v-if="icon">
      <component
        :is="icon"
        class="text-muted-foreground mt-0.5 size-4 shrink-0"
      />
      <div class="space-y-1">
        <p :class="labelClass">
          {{ label }}
        </p>
        <p v-if="address?.company" :class="companyClass">
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
      <p :class="labelClass">
        {{ label }}
      </p>
      <p v-if="address?.company" :class="companyClass">
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
