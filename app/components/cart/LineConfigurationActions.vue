<script setup lang="ts">
import { Pencil } from 'lucide-vue-next';
import type {
  LineConfigurationSummary,
  PriceType,
} from '#shared/types/commerce';
import { Button } from '~/components/ui/button';

/**
 * A configured line's two actions in one row: "Visa konfiguration", which
 * opens what it was committed with, and beside it the way back to the
 * configurator, when the line can be changed there.
 */
const { editUrl = null, disabled = false } = defineProps<{
  /** The specification trigger's id, unique on the page. */
  id: string;
  productName: string;
  quantity: number;
  configuration: LineConfigurationSummary;
  unitPrice?: PriceType;
  totalPrice?: PriceType;
  /** The configurator, opened on this line; no link without it. */
  editUrl?: string | null;
  /** The line is being changed: the link holds until it has answered. */
  disabled?: boolean;
  editTestId: string;
}>();

const emit = defineEmits<{ edit: [] }>();

const { t } = useI18n();
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <LineSpecification
      :id="id"
      :product-name="productName"
      :quantity="quantity"
      :configuration="configuration"
      :unit-price="unitPrice"
      :total-price="totalPrice"
    />
    <Button
      v-if="editUrl"
      as-child
      variant="outline"
      size="sm"
      class="h-6 gap-1 px-2 text-[11px]"
      :class="{ 'pointer-events-none opacity-50': disabled }"
    >
      <NuxtLink
        :to="editUrl"
        :aria-disabled="disabled || undefined"
        :tabindex="disabled ? -1 : undefined"
        :data-testid="editTestId"
        @click="emit('edit')"
      >
        <Pencil class="size-3" />
        {{ t('cart.edit_configuration') }}
      </NuxtLink>
    </Button>
  </div>
</template>
