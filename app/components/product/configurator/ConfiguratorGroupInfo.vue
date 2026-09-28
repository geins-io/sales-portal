<script setup lang="ts">
import type { ConfigurationMessage } from '#shared/types/configurator';
import { CircleAlert, Info, TriangleAlert } from 'lucide-vue-next';
import { groupInfoSeverity } from '~/utils/configurator-form';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip';

/**
 * A group's messages as an icon beside its title, the text in a tooltip, as
 * the prototype. One icon for all of them, in the colour of the most severe.
 *
 * Hover and keyboard focus open it the tooltip's own way. A tap does not — the
 * primitive ignores touch — so a click opens it too, and a tap outside or
 * Escape closes it. Focus opening it is also what gives a screen reader the
 * text, through the `aria-describedby` the primitive sets while it is open.
 *
 * The provider writes the text; only the severity label is translated.
 */
const { messages, groupName } = defineProps<{
  messages: ConfigurationMessage[];
  groupName: string;
}>();

const { t } = useI18n();

const open = ref(false);
const severity = computed(() => groupInfoSeverity(messages));

const icon = {
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info,
} as const;

const tone: Record<ConfigurationMessage['severity'], string> = {
  error: 'text-destructive',
  warning: 'text-warning',
  info: 'text-muted-foreground hover:text-foreground',
};
</script>

<template>
  <TooltipProvider v-if="severity">
    <Tooltip v-model:open="open" disable-closing-trigger>
      <TooltipTrigger as-child>
        <button
          type="button"
          data-testid="configurator-group-info"
          :data-severity="severity"
          class="focus-visible:ring-ring inline-flex shrink-0 cursor-help rounded-sm focus-visible:ring-2 focus-visible:outline-none"
          :class="tone[severity]"
          :aria-label="t('configurator.group_info', { name: groupName })"
          @click="open = true"
        >
          <component :is="icon[severity]" class="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent data-testid="configurator-group-info-content">
        <ul class="space-y-1">
          <li
            v-for="(message, index) in messages"
            :key="index"
            data-testid="configurator-message"
            :data-severity="message.severity"
            class="flex items-start gap-2"
          >
            <component
              :is="icon[message.severity]"
              v-if="messages.length > 1"
              class="mt-0.5 size-3.5 shrink-0"
              :class="tone[message.severity]"
            />
            <span>
              <span class="sr-only">
                {{ t(`configurator.severity.${message.severity}`) }}:
              </span>
              {{ message.text }}
            </span>
          </li>
        </ul>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
