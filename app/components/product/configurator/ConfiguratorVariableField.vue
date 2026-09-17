<script setup lang="ts">
import type {
  ConfigurationChange,
  ConfigurationValue,
  ConfigurationVariable,
} from '#shared/types/configurator';
import {
  boundsParams,
  dateChangeValue,
  dateInputValue,
  isReadOnly,
  variableControl,
} from '~/utils/configurator-form';
import { Input } from '~/components/ui/input';
import { Switch } from '~/components/ui/switch';
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from '~/components/ui/number-field';

/**
 * One `ConfigurationVariable`, as whichever control its `valueType` calls for.
 *
 * A number and a text field hold a draft and send it on blur or Enter: every
 * change is a round trip that replaces the whole document, so a keystroke is
 * not a change. A stepper click is, and sends on the click. A new document
 * always wins over an unsent draft — the watch below resets it.
 */
const { variable, disabled = false } = defineProps<{
  variable: ConfigurationVariable;
  disabled?: boolean;
}>();

const emit = defineEmits<{ change: [ConfigurationChange] }>();

const { t } = useI18n();

const control = computed(() => variableControl(variable));
const readOnly = computed(() => isReadOnly(variable.selectionSource));
const blocked = computed(
  () => disabled || readOnly.value || !variable.available,
);
const bounds = computed(() => boundsParams(variable));

const draft = ref<ConfigurationValue>(variable.value);
watch(
  () => variable.value,
  (value) => {
    draft.value = value;
  },
);

function send(value: ConfigurationValue) {
  emit('change', { type: 'variable', variableId: variable.id, value });
}

/** Nothing is sent when the draft is what the document already holds. */
function commit() {
  if (blocked.value || draft.value === variable.value) return;
  send(draft.value);
}

function onStep() {
  nextTick(commit);
}

function onSwitch(checked: boolean) {
  if (blocked.value) return;
  send(checked);
}

function onDate(event: Event) {
  if (blocked.value) return;
  send(dateChangeValue((event.target as HTMLInputElement).value));
}
</script>

<template>
  <div
    data-testid="configurator-variable"
    :data-variable-id="variable.id"
    :data-control="control"
    class="space-y-1.5"
  >
    <label class="flex items-center gap-1 text-sm font-medium">
      {{ variable.name }}
      <span v-if="variable.required" class="text-destructive">
        <span aria-hidden="true">*</span>
        <span class="sr-only">{{ t('configurator.required') }}</span>
      </span>
    </label>

    <div v-if="control === 'number'" class="flex items-center gap-2">
      <NumberField
        :model-value="typeof draft === 'number' ? draft : 0"
        :min="variable.min"
        :max="variable.max"
        :step="variable.step ?? 1"
        :disabled="blocked"
        :title="blocked ? t('configurator.read_only') : undefined"
        class="w-auto"
        @update:model-value="(value) => (draft = value ?? null)"
      >
        <NumberFieldContent class="h-10">
          <NumberFieldDecrement class="w-10" @click="onStep" />
          <NumberFieldInput
            class="w-20 font-medium tabular-nums"
            @blur="commit"
            @keydown.enter="commit"
          />
          <NumberFieldIncrement class="w-10" @click="onStep" />
        </NumberFieldContent>
      </NumberField>
      <span v-if="variable.unit" class="text-muted-foreground text-sm">
        {{ variable.unit }}
      </span>
    </div>

    <div v-else-if="control === 'boolean'" class="flex items-center gap-2">
      <Switch
        :model-value="draft === true"
        :disabled="blocked"
        :title="blocked ? t('configurator.read_only') : undefined"
        @update:model-value="onSwitch"
      />
      <span class="text-muted-foreground text-sm">
        {{ draft === true ? t('configurator.yes') : t('configurator.no') }}
      </span>
    </div>

    <Input
      v-else-if="control === 'date'"
      type="date"
      :model-value="dateInputValue(variable.value)"
      :disabled="blocked"
      :title="blocked ? t('configurator.read_only') : undefined"
      class="max-w-xs"
      @change="onDate"
    />

    <Input
      v-else
      :model-value="typeof draft === 'string' ? draft : ''"
      :disabled="blocked"
      :title="blocked ? t('configurator.read_only') : undefined"
      class="max-w-xs"
      @update:model-value="(value) => (draft = String(value))"
      @blur="commit"
      @keydown.enter="commit"
    />

    <p
      v-if="bounds"
      data-testid="configurator-bounds"
      class="text-muted-foreground text-xs"
    >
      {{ t('configurator.bounds', bounds) }}
    </p>

    <p v-if="variable.description" class="text-muted-foreground text-xs">
      {{ variable.description }}
    </p>

    <ConfiguratorMessages :messages="variable.messages" />
  </div>
</template>
