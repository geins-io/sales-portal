<script setup lang="ts">
import { Info } from 'lucide-vue-next';
import type { ReleasedChoice } from '#shared/types/configurator';

/**
 * The choices the last answer took away because the rest of the configuration
 * rules them out. The next answer brings its own list, so this lasts until the
 * buyer's next change.
 */
const { released } = defineProps<{ released?: ReleasedChoice[] }>();

const { t } = useI18n();
</script>

<template>
  <div
    v-if="released?.length"
    class="bg-info/10 text-info mb-2 flex gap-2 rounded-md px-3 py-2 text-xs lg:shrink-0"
    role="status"
    data-testid="configurator-released-notice"
  >
    <Info class="size-4 shrink-0" />
    <ul class="space-y-0.5">
      <li
        v-for="choice in released"
        :key="`${choice.optionId}|${choice.instanceId}`"
        data-testid="configurator-released-choice"
      >
        {{ t('configurator.released_choice', { name: choice.name }) }}
      </li>
    </ul>
  </div>
</template>
