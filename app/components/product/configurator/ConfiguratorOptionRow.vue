<script setup lang="ts">
import type {
  ConfigurationChange,
  ConfigurationOption,
} from '#shared/types/configurator';
import { formatPrice } from '#shared/types/commerce';
import {
  blockingMessage,
  isReadOnly,
  optionPricePrefix,
} from '~/utils/configurator-form';
import { Checkbox } from '~/components/ui/checkbox';
import { RadioGroupItem } from '~/components/ui/radio-group';

/**
 * One `ConfigurationOption`: the choice, the catalogue product embedded on the
 * row, and whatever the provider said about it.
 *
 * A single-choice row renders a `RadioGroupItem` and does not emit — the
 * `RadioGroup` in the enclosing group owns the selection and emits for it. A
 * multi-choice row owns its own checkbox and emits. The quantity stepper emits
 * either way, because a quantity belongs to the row and not to the group.
 */
const {
  option,
  single,
  quantityEditable = false,
  disabled = false,
} = defineProps<{
  option: ConfigurationOption;
  single: boolean;
  quantityEditable?: boolean;
  /** The parent locks every control while a change batch is in flight. */
  disabled?: boolean;
}>();

const emit = defineEmits<{ change: [ConfigurationChange] }>();

const { t } = useI18n();
const { formatLocale } = useFormatLocale();
const { showPrice } = usePriceVisibility();

const readOnly = computed(() => isReadOnly(option.selectionSource));
const blocked = computed(() => disabled || readOnly.value || !option.available);

/** Why the control cannot be used, on the control itself. */
const reason = computed(() => {
  if (!blocked.value || disabled) return undefined;
  const message = blockingMessage(option.messages);
  if (message) return message.text;
  return readOnly.value
    ? t('configurator.read_only')
    : t('configurator.unavailable');
});

/** What the row adds to the configuration, or nothing when it adds nothing. */
const price = computed(() => {
  const prefix = optionPricePrefix(option.unitPrice.net);
  if (prefix === null) return '';
  return `${prefix}${formatPrice(
    option.unitPrice.net,
    option.unitPrice.currency,
    formatLocale.value,
  )}`;
});

const image = computed(
  () => option.product.productImages?.find((i) => i.isPrimary)?.fileName,
);

function change(selected: boolean, quantity: number): ConfigurationChange {
  return {
    type: 'option',
    optionId: option.id,
    instanceId: option.instanceId,
    selected,
    quantity,
    lock: 'none',
  };
}

function onToggle(checked: boolean | 'indeterminate') {
  emit('change', change(checked === true, option.quantity));
}

function onQuantity(quantity: number) {
  emit('change', change(true, quantity));
}
</script>

<template>
  <div
    data-testid="configurator-option"
    :data-option-id="option.id"
    :data-selected="option.selected"
    class="rounded-lg border p-3"
    :class="[
      option.selected ? 'border-primary/60 bg-primary/5' : '',
      blocked ? 'opacity-50' : '',
    ]"
  >
    <div class="flex items-start gap-3">
      <RadioGroupItem
        v-if="single"
        :value="option.id"
        :disabled="blocked"
        :title="reason"
        class="mt-0.5"
      />
      <Checkbox
        v-else
        :model-value="option.selected"
        :disabled="blocked"
        :title="reason"
        class="mt-0.5"
        @update:model-value="onToggle"
      />

      <GeinsImage
        v-if="image"
        :file-name="image"
        type="product"
        :alt="option.product.name ?? ''"
        class="bg-muted size-10 shrink-0 rounded object-contain"
      />

      <div class="min-w-0 flex-1">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="text-sm font-medium">{{ option.product.name }}</p>
            <p
              v-if="option.product.articleNumber"
              class="text-muted-foreground text-xs"
            >
              {{ option.product.articleNumber }}
            </p>
          </div>
          <p
            v-if="showPrice && price"
            data-testid="configurator-option-price"
            class="text-muted-foreground shrink-0 text-sm tabular-nums"
          >
            {{ price }}
          </p>
        </div>

        <QuantityStepper
          v-if="quantityEditable && option.selected"
          data-testid="configurator-option-quantity"
          :model-value="option.quantity"
          :min="option.minQuantity ?? 1"
          :max="option.maxQuantity"
          :disabled="blocked"
          :aria-label="t('configurator.quantity')"
          class="mt-2"
          @update:model-value="onQuantity"
        />

        <ConfiguratorMessages :messages="option.messages" class="mt-2" />
      </div>
    </div>
  </div>
</template>
