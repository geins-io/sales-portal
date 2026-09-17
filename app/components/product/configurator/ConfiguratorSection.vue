<script setup lang="ts">
import type {
  ConfigurationChange,
  ConfigurationSection,
} from '#shared/types/configurator';
import { variablesSummary } from '~/utils/configurator-form';

/**
 * One `ConfigurationSection` and the sections nested inside it.
 *
 * `visible: false` renders nothing at all. The provider keeps data on the
 * document that is not the buyer's to see — warehouse fields, for instance —
 * and the UI hides what arrives invisible rather than deciding for itself.
 */
const {
  section,
  level = 3,
  disabled = false,
} = defineProps<{
  section: ConfigurationSection;
  /** Heading level, so a nested section does not restart the outline. */
  level?: number;
  disabled?: boolean;
}>();

const emit = defineEmits<{ change: [ConfigurationChange] }>();

const { t } = useI18n();

const heading = computed(() => `h${Math.min(level, 6)}`);

/** Empty rather than a bare separator when nothing readable is set yet. */
const summary = computed(
  () => variablesSummary(section.variables) || undefined,
);
</script>

<template>
  <section
    v-if="section.visible"
    data-testid="configurator-section"
    :data-section-id="section.id"
    class="space-y-4"
  >
    <!-- The same grey bar the groups inside it carry, so the form reads as one
         stack of headed blocks rather than two kinds of heading. -->
    <div
      class="bg-muted rounded-md px-3 py-2.5"
      data-testid="configurator-section-header"
    >
      <component :is="heading" class="text-base font-medium">
        {{ section.name }}
      </component>
    </div>

    <ConfiguratorMessages :messages="section.messages" />

    <!-- Choices first, measurements last. The contract puts variables and
         option groups in two lists and says nothing about which comes first,
         so the order follows the design reference until it does. -->
    <ConfiguratorOptionGroup
      v-for="group in section.optionGroups"
      :key="group.id"
      :group="group"
      :level="level + 1"
      :disabled="disabled"
      @change="emit('change', $event)"
    />

    <!-- The measurements are one headed block of their own, like a group, and
         two columns where there is room: a column of lone fields under the
         choices reads as leftovers. -->
    <ConfiguratorFoldable
      v-if="section.variables.length"
      name="configurator-measurements"
      :title="t('configurator.measurements')"
      :summary="summary"
      :level="level + 1"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <ConfiguratorVariableField
          v-for="variable in section.variables"
          :key="variable.id"
          :variable="variable"
          :disabled="disabled"
          @change="emit('change', $event)"
        />
      </div>
    </ConfiguratorFoldable>

    <ConfiguratorSection
      v-for="nested in section.sections"
      :key="nested.id"
      :section="nested"
      :level="level + 1"
      :disabled="disabled"
      class="border-muted border-l pl-4"
      @change="emit('change', $event)"
    />
  </section>
</template>
