<script setup lang="ts">
import type { ConfigurationMessage } from '#shared/types/configurator';
import { CircleAlert, Info, TriangleAlert } from 'lucide-vue-next';

/**
 * The `messages[]` of any node in a configuration document. The provider writes
 * the text and owns its language, so nothing here is translated; only the
 * severity label a screen reader hears is.
 */
defineProps<{ messages: ConfigurationMessage[] }>();

const { t } = useI18n();

const tone: Record<ConfigurationMessage['severity'], string> = {
  error: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-muted text-muted-foreground',
};
</script>

<template>
  <ul v-if="messages.length" class="space-y-1">
    <li
      v-for="(message, index) in messages"
      :key="index"
      data-testid="configurator-message"
      :data-severity="message.severity"
      class="flex items-start gap-2 rounded-md px-3 py-2 text-xs"
      :class="tone[message.severity]"
    >
      <CircleAlert
        v-if="message.severity === 'error'"
        class="mt-0.5 size-3.5 shrink-0"
        :aria-label="t('configurator.severity.error')"
      />
      <TriangleAlert
        v-else-if="message.severity === 'warning'"
        class="mt-0.5 size-3.5 shrink-0"
        :aria-label="t('configurator.severity.warning')"
      />
      <Info
        v-else
        class="mt-0.5 size-3.5 shrink-0"
        :aria-label="t('configurator.severity.info')"
      />
      <span>{{ message.text }}</span>
    </li>
  </ul>
</template>
