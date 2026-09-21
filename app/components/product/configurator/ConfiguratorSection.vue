<script setup lang="ts">
import type {
  ConfigurationChange,
  ConfigurationSection,
} from '#shared/types/configurator';
import { sectionBlocks } from '~/utils/configurator-order';

/**
 * One `ConfigurationSection`'s own content — its groups and its variables, in
 * the order `sortIndex` puts them.
 *
 * Not its children: a nested section is an entry of its own in the rail, so
 * rendering `section.sections` here would put a child's content on two pages at
 * once. That is also the one place the provider's order cannot be followed —
 * Monitor can number a child section between its parent's groups, and a page
 * cannot hold half of another page. A limit of the page model, not an ordering
 * bug. The heading is the page's too, because it carries the section's number
 * in the rail.
 *
 * `visible: false` renders nothing at all. The provider keeps data on the
 * document that is not the buyer's to see — warehouse fields, for instance —
 * and the UI hides what arrives invisible rather than deciding for itself.
 */
const { section, disabled = false } = defineProps<{
  section: ConfigurationSection;
  disabled?: boolean;
}>();

const emit = defineEmits<{ change: [ConfigurationChange] }>();

const blocks = computed(() => sectionBlocks(section));
</script>

<template>
  <section
    v-if="section.visible"
    data-testid="configurator-section"
    :data-section-id="section.id"
    class="space-y-4"
  >
    <ConfiguratorMessages :messages="section.messages" />

    <!-- The merchant's own arrangement, so nothing gathers the fields and no
         heading is invented over them: a variable is the section's own field
         and the section is already named. `5` is one below the `h4` the page
         renders over this section. -->
    <template v-for="(block, index) in blocks">
      <ConfiguratorOptionGroup
        v-if="block.kind === 'group'"
        :key="block.group.id"
        :group="block.group"
        :level="5"
        :disabled="disabled"
        @change="emit('change', $event)"
      />

      <!-- Fields that sit next to each other share the grid; a group between
           them starts a new one, so a lone field keeps the box it would have
           had as the odd one out of a longer run. -->
      <div
        v-else
        :key="`variables:${index}`"
        data-testid="configurator-variables"
        class="grid gap-4 sm:grid-cols-2"
      >
        <ConfiguratorVariableField
          v-for="variable in block.variables"
          :key="variable.id"
          :variable="variable"
          :disabled="disabled"
          @change="emit('change', $event)"
        />
      </div>
    </template>
  </section>
</template>
