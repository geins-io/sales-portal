<script setup lang="ts">
import type {
  ConfigurationChange,
  ConfigurationSection,
} from '#shared/types/configurator';
import { sectionMembers } from '~/utils/configurator-order';

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

const members = computed(() => sectionMembers(section));
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
    <template v-for="member in members">
      <ConfiguratorOptionGroup
        v-if="member.kind === 'group'"
        :key="member.group.id"
        :group="member.group"
        :level="5"
        :disabled="disabled"
        @change="emit('change', $event)"
      />

      <!-- A field with no group over it gets a rule and air of its own, which
           is all the framing it has. One field per row and never a shared grid:
           a date, a free text and a measurement side by side would say they
           belong together, and a section's fields are only its own. -->
      <div
        v-else
        :key="member.variable.id"
        data-testid="configurator-variable-row"
        class="border-border border-t py-5"
      >
        <ConfiguratorVariableField
          :variable="member.variable"
          :disabled="disabled"
          @change="emit('change', $event)"
        />
      </div>
    </template>
  </section>
</template>
