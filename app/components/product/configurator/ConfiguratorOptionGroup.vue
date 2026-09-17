<script setup lang="ts">
import type {
  ConfigurationChange,
  ConfigurationOptionGroup,
} from '#shared/types/configurator';
import { isSingleSelect } from '~/utils/configurator-form';
import { RadioGroup } from '~/components/ui/radio-group';

/**
 * One `ConfigurationOptionGroup`, and the groups nested inside it.
 *
 * Selecting inside a single-choice group emits one change for the row chosen,
 * not a deselect for the row it replaces: the provider drops the siblings when
 * it re-evaluates, and a client that sent both would be guessing at a rule it
 * cannot see.
 */
const {
  group,
  level = 4,
  disabled = false,
} = defineProps<{
  group: ConfigurationOptionGroup;
  /** Heading level, one below the section the group sits in. */
  level?: number;
  disabled?: boolean;
}>();

const emit = defineEmits<{ change: [ConfigurationChange] }>();

const { t } = useI18n();

const heading = computed(() => `h${Math.min(level, 6)}`);
const single = computed(() => isSingleSelect(group));
const required = computed(() => (group.minSelections ?? 0) > 0);
const locked = computed(() => disabled || !group.available);

/** No row carries an empty id, so an empty model checks nothing. */
const selectedId = computed(
  () => group.options.find((option) => option.selected)?.id ?? '',
);

function onPick(value: unknown) {
  const picked = group.options.find((option) => option.id === value);
  if (!picked) return;
  emit('change', {
    type: 'option',
    optionId: picked.id,
    instanceId: picked.instanceId,
    selected: true,
    quantity: picked.quantity,
    lock: 'none',
  });
}
</script>

<template>
  <section
    data-testid="configurator-group"
    :data-group-id="group.id"
    class="space-y-2"
  >
    <div class="flex items-baseline justify-between gap-3">
      <component :is="heading" class="text-sm font-semibold">
        {{ group.name }}
        <span v-if="required" class="text-destructive">
          <span aria-hidden="true">*</span>
          <span class="sr-only">{{ t('configurator.required') }}</span>
        </span>
      </component>
      <span class="text-muted-foreground shrink-0 text-xs">
        {{
          single ? t('configurator.choose_one') : t('configurator.choose_many')
        }}
      </span>
    </div>

    <ConfiguratorMessages :messages="group.messages" />

    <RadioGroup
      v-if="single"
      :model-value="selectedId"
      :disabled="locked"
      class="gap-2"
      @update:model-value="onPick"
    >
      <ConfiguratorOptionRow
        v-for="option in group.options"
        :key="`${option.id}-${option.instanceId}`"
        :option="option"
        single
        :quantity-editable="group.quantityEditable"
        :disabled="locked"
        @change="emit('change', $event)"
      />
    </RadioGroup>

    <div v-else class="space-y-2">
      <ConfiguratorOptionRow
        v-for="option in group.options"
        :key="`${option.id}-${option.instanceId}`"
        :option="option"
        :single="false"
        :quantity-editable="group.quantityEditable"
        :disabled="locked"
        @change="emit('change', $event)"
      />
    </div>

    <ConfiguratorOptionGroup
      v-for="nested in group.optionGroups"
      :key="nested.id"
      :group="nested"
      :level="level + 1"
      :disabled="locked"
      class="border-muted ml-3 border-l pl-3"
      @change="emit('change', $event)"
    />
  </section>
</template>
