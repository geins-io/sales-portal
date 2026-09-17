<script setup lang="ts">
import type { ConfigurationMessage } from '#shared/types/configurator';
import { CircleAlert, TriangleAlert } from 'lucide-vue-next';

/**
 * The `messages[]` of any node in a configuration document. The provider writes
 * the text and owns its language, so nothing here is translated; only the
 * severity label a screen reader hears is.
 */
defineProps<{ messages: ConfigurationMessage[] }>();

const { t } = useI18n();
</script>

<template>
  <ul v-if="messages.length" class="space-y-1">
    <li
      v-for="(message, index) in messages"
      :key="index"
      data-testid="configurator-message"
      :data-severity="message.severity"
      class="flex items-start gap-2 rounded-md px-3 py-2 text-xs"
      :class="
        message.severity === 'error'
          ? 'bg-destructive/10 text-destructive'
          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
      "
    >
      <!-- Warning keeps a hardcoded amber: the design system has no warning
           token, the same reason quote-status.ts gives for its orange. -->
      <CircleAlert
        v-if="message.severity === 'error'"
        class="mt-0.5 size-3.5 shrink-0"
        :aria-label="t('configurator.severity.error')"
      />
      <TriangleAlert
        v-else
        class="mt-0.5 size-3.5 shrink-0"
        :aria-label="t('configurator.severity.warning')"
      />
      <span>{{ message.text }}</span>
    </li>
  </ul>
</template>
