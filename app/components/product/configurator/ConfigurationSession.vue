<script setup lang="ts">
import type { ConfiguratorSessionError } from '~/composables/useConfiguratorSession';
import { Button } from '~/components/ui/button';
import { formatRemaining } from '~/utils/configurator-panel';

/**
 * How long the session has left, and the way to extend it. Under the action
 * because it is about the session rather than about the configuration; the
 * design reference has no equivalent, as its configurator held no session.
 */
const {
  remainingMs,
  busy,
  error = null,
} = defineProps<{
  remainingMs: number;
  busy: boolean;
  error?: ConfiguratorSessionError | null;
}>();

const emit = defineEmits<{ renew: [] }>();

const { t } = useI18n();
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
    data-testid="configurator-panel-expiry"
  >
    <span class="text-muted-foreground tabular-nums">
      {{
        t('configurator.panel.time_left', {
          time: formatRemaining(remainingMs),
        })
      }}
    </span>
    <Button variant="outline" size="sm" :disabled="busy" @click="emit('renew')">
      {{ t('configurator.panel.renew') }}
    </Button>
    <!--
      A 410 has already become the expired state in the panel, so anything left
      here is a renew that failed for another reason and belongs at the button.
    -->
    <span v-if="error" class="text-destructive">
      {{ t('configurator.panel.renew_failed') }}
    </span>
  </div>
</template>
